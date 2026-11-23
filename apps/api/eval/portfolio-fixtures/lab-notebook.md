# Software lab notebook

## Memory allocation
The heap stores objects that outlive a local stack frame. A profiler can record objects still reachable after a request finishes. Repeat measurements on the same workload before attributing growth to a particular change.

## Practice and feedback
During a debugging exercise, reproduce a bug with a short input. Introduce one change and rerun the test. Write down the observed output alongside the expected output so reviewers can inspect the difference.

## Branches and references
A branch name refers to a commit. Commits contain parent references and a snapshot of tracked files. A short identifier is usable only when it resolves to a single object in the repository.

## Review method
A worked example for a sorting algorithm starts with a small array and records each swap. A second input with equal keys can reveal stability behavior that the first input did not exercise. Reviewers should use both examples before drawing a conclusion.
