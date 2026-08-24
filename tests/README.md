# Stage ④A test boundary

`npm test` exercises a synthetic, rights-clear fixture and verifies:

- valid deterministic build and technical evidence;
- desktop, mobile, no-JavaScript, and reduced-motion rendering;
- stable digests across repeated builds;
- malformed HTML, missing assets, and JavaScript-only reading fail QA;
- private source-ledger material is rejected before build;
- `.env`, credentials JSON, private directories, and vendored HarryTone material are rejected before build;
- missing, failed, or stale evidence blocks the gate;
- any artifact mutation after evidence capture blocks the gate;
- unknown image rights blocks the gate;
- manifest/generator `PASS` cannot override independent technical failure;
- a blocked candidate preserves the named previous-good release.

Fixtures are synthetic and contain no production story, private research, private HarryTone material, credential, or historical artifact.

The test suite simulates local authority only. It cannot deploy or assert that a candidate is editorially, visually, culturally, or legally suitable.

The suite also guards the shared-core boundary: core CSS must retain functional accessibility and responsive primitives without defining an issue palette, display type scale, editorial width, or article rhythm. Those decisions are asserted in scoped issue CSS.
