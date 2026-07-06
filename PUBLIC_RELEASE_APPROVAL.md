# Heal Sentinel Release Hold

The build spec requests an MIT-licensed public npm release. This repo's local
operating instruction says not to add MIT labels or publish TFB code without CEO
approval.

Local v0.1.0 is therefore marked `private: true` and `UNLICENSED`.

Release switch, after CEO approval and Skybridge admission:

1. Change `private` to `false`.
2. Change `license` to the approved public license.
3. Run `npm run prepublishOnly`.
4. Attach the Skybridge admission cert to the public listing surfaces.
