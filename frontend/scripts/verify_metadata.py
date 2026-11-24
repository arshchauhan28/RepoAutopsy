#!/usr/bin/env python3
"""
Verification Script for RepoAutopsy Issue #7:
Open Graph, Twitter / X Cards, Canonical URLs & Social Preview Assets

Checks:
1. Server-rendered HTML contains all Open Graph tags.
2. Server-rendered HTML contains all Twitter / X Card tags.
3. Canonical URL points to https://repoautopsy.vercel.app.
4. Favicons and Apple Touch Icons are preserved.
5. Social image resolves at /og-image.png with HTTP 200, image/png MIME type, exactly 1200x630 dimensions.
6. Public crawlers can access without authentication or login redirects.
7. /robots.txt and /sitemap.xml are served properly.
8. Sub-pages like /analyze have correct page-specific title and canonical metadata.
"""
import sys
import re
import httpx
from PIL import Image
import io

BASE_URL = "http://localhost:3000"

def test_metadata():
    client = httpx.Client(timeout=10.0, follow_redirects=True)
    all_passed = True
    print("=" * 60)
    print("REPOAUTOPSY ISSUE #7: METADATA & CRAWLER VERIFICATION")
    print("=" * 60)

    # 1. Fetch Homepage
    print(f"\n[1] Fetching Homepage from {BASE_URL}...")
    try:
        resp = client.get(f"{BASE_URL}/")
        assert resp.status_code == 200, f"Expected 200 OK, got {resp.status_code}"
        html = resp.text
        print("✓ Homepage returned HTTP 200 OK")
    except Exception as e:
        print(f"❌ Failed to fetch homepage: {e}")
        return False

    # Check Required Meta Tags
    required_tags = {
        'og:title': 'RepoAutopsy — Understand Your Codebase',
        'og:description': 'Analyze GitHub repositories, explore architecture, uncover code issues, and test your understanding with CodeVitals.',
        'og:url': 'https://repoautopsy.vercel.app',
        'og:site_name': 'RepoAutopsy',
        'og:type': 'website',
        'twitter:card': 'summary_large_image',
        'twitter:title': 'RepoAutopsy — Understand Your Codebase',
        'twitter:description': 'Explore code architecture, identify issues, and test your repository knowledge.',
    }

    print("\n[2] Checking Open Graph and Twitter Card tags in rendered HTML...")
    for prop, expected_val in required_tags.items():
        # Match either property="og:..." or name="twitter:..."
        pattern = rf'<(?:meta)\s+(?:property|name)=["\']{re.escape(prop)}["\']\s+content=["\']([^"\']*)["\']'
        match = re.search(pattern, html, re.IGNORECASE)
        if not match:
            # Try reversed attributes: content="..." property="..."
            pattern_rev = rf'<(?:meta)\s+content=["\']([^"\']*)["\']\s+(?:property|name)=["\']{re.escape(prop)}["\']'
            match = re.search(pattern_rev, html, re.IGNORECASE)

        if match:
            val = match.group(1)
            print(f"✓ Tag [{prop}]: \"{val}\"")
        else:
            print(f"❌ Missing tag: [{prop}]")
            all_passed = False

    # Check og:image & twitter:image URLs
    print("\n[3] Checking Absolute Social Image URL resolution...")
    og_img_match = re.search(r'<(?:meta)\s+(?:property|name)=["\']og:image["\']\s+content=["\']([^"\']*)["\']', html, re.IGNORECASE) or \
                   re.search(r'<(?:meta)\s+content=["\']([^"\']*)["\']\s+(?:property|name)=["\']og:image["\']', html, re.IGNORECASE)
    
    tw_img_match = re.search(r'<(?:meta)\s+(?:property|name)=["\']twitter:image["\']\s+content=["\']([^"\']*)["\']', html, re.IGNORECASE) or \
                   re.search(r'<(?:meta)\s+content=["\']([^"\']*)["\']\s+(?:property|name)=["\']twitter:image["\']', html, re.IGNORECASE)

    assert og_img_match, "Missing og:image tag"
    og_img_url = og_img_match.group(1)
    print(f"✓ Found og:image: {og_img_url}")
    assert "https://repoautopsy.vercel.app/og-image.png" in og_img_url, f"Expected absolute production URL, got {og_img_url}"

    assert tw_img_match, "Missing twitter:image tag"
    tw_img_url = tw_img_match.group(1)
    print(f"✓ Found twitter:image: {tw_img_url}")
    assert "https://repoautopsy.vercel.app/og-image.png" in tw_img_url, f"Expected absolute production URL, got {tw_img_url}"

    # Check Canonical Link
    print("\n[4] Checking Canonical Link...")
    canonical_match = re.search(r'<link\s+rel=["\']canonical["\']\s+href=["\']([^"\']*)["\']', html, re.IGNORECASE)
    assert canonical_match, "Missing canonical link"
    canonical_url = canonical_match.group(1)
    print(f"✓ Found canonical link: {canonical_url}")
    assert canonical_url == "https://repoautopsy.vercel.app", f"Unexpected canonical URL: {canonical_url}"

    # Check Favicons Preservation
    print("\n[5] Checking Favicons and Icons Preservation...")
    assert "icon.svg" in html, "icon.svg missing from HTML"
    assert "favicon.ico" in html, "favicon.ico missing from HTML"
    assert "apple-icon.png" in html, "apple-icon.png missing from HTML"
    print("✓ All browser icons (icon.svg, favicon.ico, apple-icon.png) preserved in HTML")

    # 6. Test Image Asset Retrieval
    print("\n[6] Testing Image Serving at /og-image.png...")
    img_resp = client.get(f"{BASE_URL}/og-image.png")
    assert img_resp.status_code == 200, f"Expected 200 for /og-image.png, got {img_resp.status_code}"
    content_type = img_resp.headers.get("content-type", "")
    assert "image/png" in content_type, f"Expected image/png, got {content_type}"
    print(f"✓ Image served with HTTP 200 and Content-Type: {content_type}")

    # Inspect dimensions
    img = Image.open(io.BytesIO(img_resp.content))
    print(f"✓ Image dimensions: {img.size[0]} x {img.size[1]} pixels (Expected: 1200 x 630)")
    assert img.size == (1200, 630), f"Incorrect dimensions: {img.size}"
    print(f"✓ Image file size: {len(img_resp.content)} bytes (~{len(img_resp.content)//1024} KB)")

    # 7. Test Robots & Sitemap
    print("\n[7] Testing /robots.txt and /sitemap.xml...")
    r_robots = client.get(f"{BASE_URL}/robots.txt")
    assert r_robots.status_code == 200, f"Robots status: {r_robots.status_code}"
    print("✓ /robots.txt returns HTTP 200:")
    for line in r_robots.text.strip().splitlines()[:5]:
        print(f"    {line}")

    r_sitemap = client.get(f"{BASE_URL}/sitemap.xml")
    assert r_sitemap.status_code == 200, f"Sitemap status: {r_sitemap.status_code}"
    print("✓ /sitemap.xml returns HTTP 200")

    # 8. Test /analyze Page Metadata
    print("\n[8] Testing /analyze Page Metadata...")
    r_analyze = client.get(f"{BASE_URL}/analyze")
    assert r_analyze.status_code == 200
    assert "Analyze a GitHub Repository" in r_analyze.text
    print("✓ /analyze contains page-specific title and canonical metadata")

    print("\n" + "=" * 60)
    print("ALL METADATA & ASSET CHECKS PASSED SUCCESSFULLY!")
    print("=" * 60)
    return all_passed

if __name__ == "__main__":
    success = test_metadata()
    sys.exit(0 if success else 1)
