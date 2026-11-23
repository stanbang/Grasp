# From the RAG course to the Grasp walkthrough

The walkthrough teaches retrieval, prompt augmentation, generation and source inspection through a question about computer networks. The previous [shared Grasp review](https://chatgpt.com/share/6b04afc4-939c-83ec-99ab-1b58f98d5dba) supplied the architecture image and highlighted three distinctions worth making visible. The graph helps readers navigate sources. Exact quotation checks establish provenance. Retrieval scores tell us how the search ranked evidence.

Use the [official course syllabus](https://www.coursera.org/learn/retrieval-augmented-generation-rag/) for the topic order. The [opening lesson](https://learn.deeplearning.ai/courses/retrieval-augmented-generation/lesson/rrngb/a-conversation-with-andrew-ng) asks for a DeepLearning.AI login. The walkthrough uses the public topics and original Grasp examples. The shared review reports its own transcript coverage and is treated as background. Grasp behavior and metrics come from the repository.

| Course area | What the reader can do in Grasp | Where to verify it |
| --- | --- | --- |
| RAG overview | Switch from preparing notes to answering a question. Follow the question, retrieved text, augmented prompt and citation. | [Ingestion](../apps/api/app/ingestion.py) · [Chat route](../apps/api/app/study_routes.py) |
| Search and retrieval | Change candidate order in the recorded experiment. Check whether the labelled source made it into the first results. | [Experiment](evaluation.md#portfolio-method) |
| Vector databases | Compare the default and shorter chunks. Inspect the number of indexed passages and the amount of text returned. | [Recorded runs](facts.md#earlier-portfolio-runs) |
| Generation and grounding | Decide whether a real quote supports a proposed claim, then open the recorded answer and its source. | [Network trace](../apps/web/src/showcase/traces/computer-networks.json) · [Citation validator](../apps/api/app/study_routes.py) |
| Production | Compare the static public replay with the local workspace. Identify what data live mode sends and what would need to be measured to operate a service. | [Deployment](deployment.md) · [Measurements](facts.md#proposed-measurements-and-cost) |

The small lessons use the same project evidence as the README. The [interview talk track](interview-talk-track.md) gives longer answers, and [the bibliography and commands](facts.md) let a reader check the claims.
