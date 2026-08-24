# QA boundary

The accepted candidate includes its public local QA report, but repository-native tests are not implemented yet.

The future independent suite must cover at least:

- public manifest schema;
- content hash lock;
- HTML parsing and complete source rendering;
- asset and internal-link integrity;
- full no-JavaScript reading;
- keyboard and accessibility basics;
- desktop 1440×900 and mobile 390×844 rendering;
- reduced motion;
- artifact immutability and fail-closed release behavior.

Editorial and visual review evidence must remain separate from deterministic CI evidence.
