"""Standalone sanity check for src/python/tracer.py (run with system python3)."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "src", "python"))

import tracer  # noqa: E402


def show(title, out_json):
    out = json.loads(out_json)
    print(f"\n=== {title} ===")
    print("steps:", len(out["steps"]), "truncated:", out["truncated"], "error:", out["error"])
    print("result:", out["result"])
    if out["steps"]:
        s = out["steps"][-1]
        print("last step:", s["event"], "line", s["line"], "locals keys", list(s["locals"].keys()))


# 1) two-sum (array + hashmap)
two_sum = '''
class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, n in enumerate(nums):
            if target - n in seen:
                return [seen[target - n], i]
            seen[n] = i
        return []
'''
show("two_sum", tracer.run_trace(two_sum, "twoSum", json.dumps([[2, 7, 11, 15], 9]), json.dumps(["array", "raw"])))

# 2) reverse linked list (linked_list coercion + serialization)
rev = '''
class Solution:
    def reverseList(self, head):
        prev = None
        cur = head
        while cur:
            nxt = cur.next
            cur.next = prev
            prev = cur
            cur = nxt
        return prev
'''
out = json.loads(tracer.run_trace(rev, "reverseList", json.dumps([[1, 2, 3]]), json.dumps(["linked_list"])))
print("\n=== reverse_list ===")
print("steps:", len(out["steps"]), "result kind:", out["result"]["kind"])
print("result nodes:", [n["value"]["value"] for n in out["result"]["nodes"]])
print("arg0 kind:", out["args"][0]["kind"])

# 3) tree serialization via return
tree = '''
class Solution:
    def invertTree(self, root):
        if not root:
            return None
        root.left, root.right = self.invertTree(root.right), self.invertTree(root.left)
        return root
'''
out = json.loads(tracer.run_trace(tree, "invertTree", json.dumps([[4, 2, 7, 1, 3, 6, 9]]), json.dumps(["tree"])))
print("\n=== invert_tree ===")
print("steps:", len(out["steps"]), "result kind:", out["result"]["kind"])
print("root val:", out["result"]["root"]["value"]["value"], "left val:", out["result"]["root"]["left"]["value"]["value"])

# 4) exception handling
boom = '''
def solve(nums):
    x = nums[0]
    return nums[10]
'''
show("exception", tracer.run_trace(boom, "solve", json.dumps([[1, 2, 3]]), json.dumps(["array"])))

# 5) infinite loop -> truncated
inf = '''
def solve(n):
    i = 0
    while True:
        i += 1
'''
show("infinite_loop", tracer.run_trace(inf, "solve", json.dumps([0]), json.dumps(["raw"])))

print("\nALL TRACER TESTS RAN")
