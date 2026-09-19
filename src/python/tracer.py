"""In-Pyodide execution tracer.

Runs a user's Python solution under sys.settrace(), capturing one step per
'line' event (line number, deep-copied locals, stack depth, event type), and
returns the ENTIRE run as a single JSON string. No streaming, no callbacks --
the side panel parses this blob once and replays it locally.

Only the data shapes the demo problems need are serialized: primitives, arrays,
dicts/hashmaps, singly-linked lists, and binary trees. Everything else
degrades to a repr.
"""

import sys
import io
import json
import math
import inspect
import contextlib
from collections import deque
from typing import Any, Deque, Dict, List, Optional, Set, Tuple, Union

USER_FILE = "<user_solution>"
MAX_STEPS = 500
_MAX_NODES = 512  # guard for linked-list / tree serialization


# ---- Data structures matching LeetCode/NeetCode conventions ---------------
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


def build_linked_list(arr):
    head = None
    for v in reversed(list(arr)):
        head = ListNode(v, head)
    return head


def build_tree(arr):
    """Build a binary tree from LeetCode level-order notation with None gaps."""
    arr = list(arr)
    if not arr or arr[0] is None:
        return None
    it = iter(arr)
    root = TreeNode(next(it))
    q = deque([root])
    while q:
        node = q.popleft()
        try:
            lv = next(it)
        except StopIteration:
            break
        if lv is not None:
            node.left = TreeNode(lv)
            q.append(node.left)
        try:
            rv = next(it)
        except StopIteration:
            break
        if rv is not None:
            node.right = TreeNode(rv)
            q.append(node.right)
    return root


# ---- Serialization --------------------------------------------------------
def _is_tree_node(o):
    return isinstance(o, TreeNode) or (
        hasattr(o, "val") and hasattr(o, "left") and hasattr(o, "right")
    )


def _is_list_node(o):
    return isinstance(o, ListNode) or (
        hasattr(o, "val") and hasattr(o, "next") and not _is_tree_node(o)
    )


def _primitive(o):
    if isinstance(o, bool) or o is None or isinstance(o, (int, str)):
        return {"kind": "primitive", "value": o}
    if isinstance(o, float):
        if math.isnan(o) or math.isinf(o):
            return {"kind": "primitive", "value": repr(o)}
        return {"kind": "primitive", "value": o}
    return None


def serialize(o):
    prim = _primitive(o)
    if prim is not None:
        return prim
    if isinstance(o, (list, tuple)):
        return {"kind": "array", "items": [serialize(x) for x in o]}
    if isinstance(o, dict):
        # Preserve insertion order as an entries list (JSON objects aren't ordered).
        return {
            "kind": "map",
            "entries": [{"key": serialize(k), "value": serialize(v)} for k, v in o.items()],
        }
    if _is_tree_node(o):
        return {"kind": "tree", "root": _serialize_tree(o, set())}
    if _is_list_node(o):
        return _serialize_linked_list(o)
    try:
        r = repr(o)
    except Exception:
        r = "<unrepresentable>"
    return {"kind": "repr", "repr": r, "type": type(o).__name__}


def _serialize_linked_list(head):
    nodes = []
    seen = set()
    cur = head
    while cur is not None and len(nodes) < _MAX_NODES:
        if id(cur) in seen:  # cycle (e.g. Linked List Cycle problems)
            break
        seen.add(id(cur))
        nodes.append({"id": id(cur), "value": serialize(getattr(cur, "val", None))})
        cur = getattr(cur, "next", None)
    return {"kind": "linked_list", "nodes": nodes}


def _serialize_tree(node, seen):
    if node is None or id(node) in seen or len(seen) > _MAX_NODES:
        return None
    seen.add(id(node))
    return {
        "id": id(node),
        "value": serialize(getattr(node, "val", None)),
        "left": _serialize_tree(getattr(node, "left", None), seen),
        "right": _serialize_tree(getattr(node, "right", None), seen),
    }


def _skip_local(k, v):
    if k.startswith("__") or k == "self":
        return True
    if inspect.isfunction(v) or inspect.ismethod(v) or inspect.isbuiltin(v):
        return True
    if inspect.isclass(v) or inspect.ismodule(v):
        return True
    return False


def serialize_locals(frame_locals):
    out = {}
    for k, v in list(frame_locals.items()):
        if _skip_local(k, v):
            continue
        try:
            out[k] = serialize(v)
        except Exception:
            out[k] = {"kind": "repr", "repr": "<unserializable>", "type": type(v).__name__}
    return out


# ---- Tracing --------------------------------------------------------------
class _StepCap(Exception):
    """Raised to abort a run once MAX_STEPS is exceeded (suspected infinite loop)."""


def _resolve_target(ns, entry_name):
    """Locate the callable to run: a Solution method or a top-level function."""
    Solution = ns.get("Solution")
    if Solution is not None and inspect.isclass(Solution):
        inst = Solution()
        methods = [
            name
            for name, _ in inspect.getmembers(inst, predicate=inspect.ismethod)
            if not name.startswith("_")
        ]
        name = entry_name if entry_name in methods else (methods[0] if methods else None)
        if name is None:
            raise RuntimeError("Solution class has no public method to run.")
        return getattr(inst, name), name
    funcs = {
        k: v
        for k, v in ns.items()
        if inspect.isfunction(v) and getattr(v, "__code__", None) and v.__code__.co_filename == USER_FILE
    }
    if entry_name in funcs:
        return funcs[entry_name], entry_name
    if funcs:
        name = next(iter(funcs))
        return funcs[name], name
    raise RuntimeError("No top-level function or Solution class found in the code.")


def run_trace(user_code, entry_name, args_json, coercions_json):
    ns = {
        "ListNode": ListNode,
        "TreeNode": TreeNode,
        "Any": Any,
        "Deque": Deque,
        "Dict": Dict,
        "List": List,
        "Optional": Optional,
        "Set": Set,
        "Tuple": Tuple,
        "Union": Union,
    }
    try:
        compiled = compile(user_code, USER_FILE, "exec")
        exec(compiled, ns)
    except Exception as e:  # syntax error etc.
        return json.dumps(
            {
                "steps": [],
                "result": None,
                "error": {"type": type(e).__name__, "message": str(e), "line": getattr(e, "lineno", None)},
                "truncated": False,
                "stdout": "",
                "args": [],
                "entry": entry_name,
            }
        )

    raw_args = json.loads(args_json)
    coercions = json.loads(coercions_json)
    built_args = []
    for i, a in enumerate(raw_args):
        c = coercions[i] if i < len(coercions) else "raw"
        if c == "linked_list":
            built_args.append(build_linked_list(a))
        elif c == "tree":
            built_args.append(build_tree(a))
        else:
            built_args.append(a)

    try:
        target, _resolved_name = _resolve_target(ns, entry_name)
    except Exception as e:
        return json.dumps(
            {
                "steps": [],
                "result": None,
                "error": {"type": type(e).__name__, "message": str(e), "line": None},
                "truncated": False,
                "stdout": "",
                "args": [serialize(a) for a in built_args],
                "entry": entry_name,
            }
        )

    steps = []
    state = {"truncated": False}

    def base_depth(frame):
        d = 0
        f = frame.f_back
        while f is not None:
            if f.f_code.co_filename == USER_FILE:
                d += 1
            f = f.f_back
        return d

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != USER_FILE:
            return None
        if event == "line":
            if len(steps) >= MAX_STEPS:
                state["truncated"] = True
                raise _StepCap()
            steps.append(
                {
                    "step": len(steps),
                    "line": frame.f_lineno,
                    "depth": base_depth(frame),
                    "func": frame.f_code.co_name,
                    "locals": serialize_locals(frame.f_locals),
                    "event": "line",
                }
            )
        elif event == "return":
            steps.append(
                {
                    "step": len(steps),
                    "line": frame.f_lineno,
                    "depth": base_depth(frame),
                    "func": frame.f_code.co_name,
                    "locals": serialize_locals(frame.f_locals),
                    "event": "return",
                    "returnValue": serialize(arg),
                }
            )
        elif event == "exception":
            exc_type, exc_value, _tb = arg
            steps.append(
                {
                    "step": len(steps),
                    "line": frame.f_lineno,
                    "depth": base_depth(frame),
                    "func": frame.f_code.co_name,
                    "locals": serialize_locals(frame.f_locals),
                    "event": "exception",
                    "error": {"type": exc_type.__name__, "message": str(exc_value), "line": frame.f_lineno},
                }
            )
        return tracer

    result = None
    error = None
    stdout_buf = io.StringIO()
    sys.settrace(tracer)
    try:
        with contextlib.redirect_stdout(stdout_buf):
            ret = target(*built_args)
        result = serialize(ret)
    except _StepCap:
        state["truncated"] = True
    except Exception as e:
        tb = sys.exc_info()[2]
        line = None
        t = tb
        while t is not None:
            if t.tb_frame.f_code.co_filename == USER_FILE:
                line = t.tb_lineno
            t = t.tb_next
        error = {"type": type(e).__name__, "message": str(e), "line": line}
    finally:
        sys.settrace(None)

    return json.dumps(
        {
            "steps": steps,
            "result": result,
            "error": error,
            "truncated": state["truncated"],
            "stdout": stdout_buf.getvalue(),
            "args": [serialize(a) for a in built_args],
            "entry": entry_name,
        }
    )
