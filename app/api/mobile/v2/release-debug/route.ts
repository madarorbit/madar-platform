import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'MADAR-Mobile-Release-Diagnostics',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function read(url: string) {
  const response = await fetch(url, { headers, cache: 'no-store' });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Keep the plain response for diagnostics.
  }
  return { status: response.status, body };
}

export async function GET() {
  const repo = 'madarorbit/madar-platform';
  const [release, publisherRuns, apkRuns] = await Promise.all([
    read(`https://api.github.com/repos/${repo}/releases/tags/mobile-v2-beta`),
    read(`https://api.github.com/repos/${repo}/actions/workflows/mobile-v2-publish-release.yml/runs?branch=main&per_page=5`),
    read(`https://api.github.com/repos/${repo}/actions/workflows/mobile-v2-apk.yml/runs?branch=main&per_page=5`),
  ]);

  return NextResponse.json({ release, publisherRuns, apkRuns });
}
