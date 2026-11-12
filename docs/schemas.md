# Data contracts

The Python source is `apps/api/app/schemas.py`. Run `python scripts/generate_contracts.py --check` with the project virtual environment to check the TypeScript mirror and this document.

Pages are one-based. Chunk offsets count Unicode code points within the extracted page text, and charEnd is exclusive. A browser must use `Array.from(pageText)` before applying those offsets. PDF citations refer to extracted text, not coordinates on a rendered PDF.

exploredCount includes learning and mastered nodes. coveragePercent is the percentage of nodes explored, or zero for an empty graph. crossDocLinks counts each extra document attached to a concept after its first document. Reprocessing the same concept/document pair does not add another link. These semantics will be implemented with ingestion and mastery.

Quiz.answerIndex is an internal answer key. The quiz delivery endpoint in Phase 5 will use a separate public question model so the answer key is not sent before grading.

### Quiz

```json
{
  "additionalProperties": false,
  "properties": {
    "question": {
      "minLength": 1,
      "title": "Question",
      "type": "string"
    },
    "options": {
      "maxItems": 3,
      "minItems": 3,
      "prefixItems": [
        {
          "type": "string"
        },
        {
          "type": "string"
        },
        {
          "type": "string"
        }
      ],
      "title": "Options",
      "type": "array"
    },
    "answerIndex": {
      "maximum": 2,
      "minimum": 0,
      "title": "Answerindex",
      "type": "integer"
    }
  },
  "required": [
    "question",
    "options",
    "answerIndex"
  ],
  "title": "Quiz",
  "type": "object"
}
```

### GraphNode

```json
{
  "$defs": {
    "Quiz": {
      "additionalProperties": false,
      "properties": {
        "question": {
          "minLength": 1,
          "title": "Question",
          "type": "string"
        },
        "options": {
          "maxItems": 3,
          "minItems": 3,
          "prefixItems": [
            {
              "type": "string"
            },
            {
              "type": "string"
            },
            {
              "type": "string"
            }
          ],
          "title": "Options",
          "type": "array"
        },
        "answerIndex": {
          "maximum": 2,
          "minimum": 0,
          "title": "Answerindex",
          "type": "integer"
        }
      },
      "required": [
        "question",
        "options",
        "answerIndex"
      ],
      "title": "Quiz",
      "type": "object"
    }
  },
  "additionalProperties": false,
  "properties": {
    "id": {
      "title": "Id",
      "type": "string"
    },
    "label": {
      "title": "Label",
      "type": "string"
    },
    "summary": {
      "title": "Summary",
      "type": "string"
    },
    "docIds": {
      "items": {
        "type": "string"
      },
      "title": "Docids",
      "type": "array"
    },
    "sourceChunkIds": {
      "items": {
        "type": "string"
      },
      "title": "Sourcechunkids",
      "type": "array"
    },
    "masteryState": {
      "enum": [
        "unexplored",
        "learning",
        "mastered"
      ],
      "title": "Masterystate",
      "type": "string"
    },
    "quiz": {
      "anyOf": [
        {
          "$ref": "#/$defs/Quiz"
        },
        {
          "type": "null"
        }
      ],
      "default": null
    }
  },
  "required": [
    "id",
    "label",
    "summary",
    "docIds",
    "sourceChunkIds",
    "masteryState"
  ],
  "title": "GraphNode",
  "type": "object"
}
```

### GraphEdge

```json
{
  "additionalProperties": false,
  "properties": {
    "id": {
      "title": "Id",
      "type": "string"
    },
    "source": {
      "title": "Source",
      "type": "string"
    },
    "target": {
      "title": "Target",
      "type": "string"
    },
    "relationshipLabel": {
      "title": "Relationshiplabel",
      "type": "string"
    },
    "docIds": {
      "items": {
        "type": "string"
      },
      "title": "Docids",
      "type": "array"
    }
  },
  "required": [
    "id",
    "source",
    "target",
    "relationshipLabel",
    "docIds"
  ],
  "title": "GraphEdge",
  "type": "object"
}
```

### Chunk

```json
{
  "additionalProperties": false,
  "properties": {
    "id": {
      "title": "Id",
      "type": "string"
    },
    "docId": {
      "title": "Docid",
      "type": "string"
    },
    "page": {
      "minimum": 1,
      "title": "Page",
      "type": "integer"
    },
    "text": {
      "title": "Text",
      "type": "string"
    },
    "charStart": {
      "minimum": 0,
      "title": "Charstart",
      "type": "integer"
    },
    "charEnd": {
      "minimum": 0,
      "title": "Charend",
      "type": "integer"
    }
  },
  "required": [
    "id",
    "docId",
    "page",
    "text",
    "charStart",
    "charEnd"
  ],
  "title": "Chunk",
  "type": "object"
}
```

### Document

```json
{
  "additionalProperties": false,
  "properties": {
    "id": {
      "title": "Id",
      "type": "string"
    },
    "name": {
      "title": "Name",
      "type": "string"
    },
    "status": {
      "enum": [
        "queued",
        "chunking",
        "extracting",
        "done",
        "failed"
      ],
      "title": "Status",
      "type": "string"
    },
    "uploadedAt": {
      "format": "date-time",
      "title": "Uploadedat",
      "type": "string"
    }
  },
  "required": [
    "id",
    "name",
    "status",
    "uploadedAt"
  ],
  "title": "Document",
  "type": "object"
}
```

### Citation

```json
{
  "additionalProperties": false,
  "properties": {
    "chunkId": {
      "title": "Chunkid",
      "type": "string"
    },
    "docId": {
      "title": "Docid",
      "type": "string"
    },
    "page": {
      "minimum": 1,
      "title": "Page",
      "type": "integer"
    },
    "quote": {
      "title": "Quote",
      "type": "string"
    }
  },
  "required": [
    "chunkId",
    "docId",
    "page",
    "quote"
  ],
  "title": "Citation",
  "type": "object"
}
```

### ChatResponse

```json
{
  "$defs": {
    "Citation": {
      "additionalProperties": false,
      "properties": {
        "chunkId": {
          "title": "Chunkid",
          "type": "string"
        },
        "docId": {
          "title": "Docid",
          "type": "string"
        },
        "page": {
          "minimum": 1,
          "title": "Page",
          "type": "integer"
        },
        "quote": {
          "title": "Quote",
          "type": "string"
        }
      },
      "required": [
        "chunkId",
        "docId",
        "page",
        "quote"
      ],
      "title": "Citation",
      "type": "object"
    }
  },
  "additionalProperties": false,
  "properties": {
    "answer": {
      "title": "Answer",
      "type": "string"
    },
    "citations": {
      "items": {
        "$ref": "#/$defs/Citation"
      },
      "title": "Citations",
      "type": "array"
    },
    "referencedNodeIds": {
      "items": {
        "type": "string"
      },
      "title": "Referencednodeids",
      "type": "array"
    }
  },
  "required": [
    "answer",
    "citations",
    "referencedNodeIds"
  ],
  "title": "ChatResponse",
  "type": "object"
}
```

### Progress

```json
{
  "additionalProperties": false,
  "properties": {
    "masteredCount": {
      "minimum": 0,
      "title": "Masteredcount",
      "type": "integer"
    },
    "exploredCount": {
      "minimum": 0,
      "title": "Exploredcount",
      "type": "integer"
    },
    "totalNodes": {
      "minimum": 0,
      "title": "Totalnodes",
      "type": "integer"
    },
    "coveragePercent": {
      "maximum": 100,
      "minimum": 0,
      "title": "Coveragepercent",
      "type": "number"
    },
    "crossDocLinks": {
      "minimum": 0,
      "title": "Crossdoclinks",
      "type": "integer"
    }
  },
  "required": [
    "masteredCount",
    "exploredCount",
    "totalNodes",
    "coveragePercent",
    "crossDocLinks"
  ],
  "title": "Progress",
  "type": "object"
}
```
