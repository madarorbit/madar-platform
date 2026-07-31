# MADAR standalone Android APK

The installable APK is built by EAS from GitHub Actions:

1. Install the locked mobile dependencies.
2. Validate TypeScript, Expo configuration, and the authenticated Expo account.
3. Link the existing EAS project.
4. Build the `preview` profile as a signed standalone release APK.
5. Verify the APK contains its JavaScript bundle and therefore does not depend on Metro.
6. Upload the APK, EAS metadata, and SHA-256 checksum as the `madar-mobile-release-apk` artifact.

The previous `assembleDebug` workflow produced an APK that expected Metro on port 8081 and failed with `Unable to load script`. It must not be restored. Google Play distribution uses the production EAS/AAB profile.
