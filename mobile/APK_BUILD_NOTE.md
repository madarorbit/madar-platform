# MADAR prototype APK build

The prototype APK is built directly in GitHub Actions from the managed Expo project:

1. Install the locked mobile dependencies.
2. Validate TypeScript and Expo configuration.
3. Generate the native Android project with `expo prebuild`.
4. Compile `app-debug.apk` with Gradle and Java 17.
5. Upload the APK and its SHA-256 checksum as the `madar-mobile-prototype-apk` artifact.

This prototype build is signed with Android's generated debug key and is intended only for direct testing. Google Play distribution must use the production EAS/AAB profile and a permanent release signing key.
