import assert from "node:assert/strict";
import test from "node:test";
import { isPublicAddress, isRemoteImageUrl } from "../src/server/remote-image.ts";

test("image downloads reject private and reserved network addresses", () => {
  for (const address of ["127.0.0.1", "10.2.3.4", "169.254.169.254", "172.31.1.1", "192.168.1.1", "100.64.1.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "2001:db8::1", "2002:7f00:1::", "not-an-ip"]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress("1.1.1.1"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});

test("image URLs cannot carry credentials or target local names", () => {
  for (const address of ["file:///etc/passwd", "ftp://example.com/image", "https://user:password@example.com/image", "http://localhost/image", "http://test.local/image", "http://test.localhost/image"]) {
    assert.equal(isRemoteImageUrl(new URL(address)), false, address);
  }
  assert.equal(isRemoteImageUrl(new URL("https://example.com/image.png")), true);
});
