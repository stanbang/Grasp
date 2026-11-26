# Keep the current retrieval baseline

**Status:** Implemented baseline. **Measured** shorter chunks and term reordering.

Keep recursive 900/150 splitting and vector order for the local workspace. The archived Gemini baseline found 19 of 20 answers at Hit@3. Both shorter chunks and term reordering recovered the miss, and both reached 20 of 20. Shorter chunks used more index entries and returned fewer evidence characters.

The questions were used to choose and inspect variants. Test both changes on unseen notes before shipping either. Hold the generator fixed when checking answer support, cost and latency. [Portfolio runs](../facts.md#earlier-portfolio-runs)
