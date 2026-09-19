// Built-in demo problems so the pipeline is demoable without a live site
// (Stage 1). Each mirrors the shape scraped from NeetCode/LeetCode.

import type { TestCase } from "../shared/types";

export interface Sample {
  id: string;
  label: string;
  code: string;
  signature: string;
  testCases: TestCase[];
}

export const SAMPLES: Sample[] = [
  {
    id: "two-sum",
    label: "Two Sum (array + hashmap)",
    signature: "def twoSum(self, nums, target)",
    code: `class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, n in enumerate(nums):
            need = target - n
            if need in seen:
                return [seen[need], i]
            seen[n] = i
        return []
`,
    testCases: [
      { name: "Example 1", input: "nums = [2,7,11,15], target = 9", expected: "[0,1]" },
      { name: "Example 2", input: "nums = [3,2,4], target = 6", expected: "[1,2]" },
    ],
  },
  {
    id: "valid-palindrome",
    label: "Valid Palindrome (two pointers)",
    signature: "def isPalindrome(self, s)",
    code: `class Solution:
    def isPalindrome(self, s):
        chars = [c.lower() for c in s if c.isalnum()]
        l, r = 0, len(chars) - 1
        while l < r:
            if chars[l] != chars[r]:
                return False
            l += 1
            r -= 1
        return True
`,
    testCases: [
      { name: "Example 1", input: 's = "A man, a plan, a canal: Panama"', expected: "true" },
      { name: "Example 2", input: 's = "race a car"', expected: "false" },
    ],
  },
  {
    id: "reverse-list",
    label: "Reverse Linked List",
    signature: "def reverseList(self, head)",
    code: `class Solution:
    def reverseList(self, head):
        prev = None
        cur = head
        while cur:
            nxt = cur.next
            cur.next = prev
            prev = cur
            cur = nxt
        return prev
`,
    testCases: [{ name: "Example 1", input: "head = [1,2,3,4,5]", expected: "[5,4,3,2,1]" }],
  },
  {
    id: "invert-tree",
    label: "Invert Binary Tree",
    signature: "def invertTree(self, root)",
    code: `class Solution:
    def invertTree(self, root):
        if not root:
            return None
        root.left, root.right = root.right, root.left
        self.invertTree(root.left)
        self.invertTree(root.right)
        return root
`,
    testCases: [{ name: "Example 1", input: "root = [4,2,7,1,3,6,9]", expected: "[4,7,2,9,6,3,1]" }],
  },
];
