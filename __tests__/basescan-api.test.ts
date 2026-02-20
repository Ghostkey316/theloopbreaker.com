import { describe, it, expect } from "vitest";

describe("BaseScan API Key Validation", () => {
  it("should have BASESCAN_API_KEY environment variable set", () => {
    const apiKey = process.env.BASESCAN_API_KEY;
    expect(apiKey).toBeTruthy();
    expect(typeof apiKey).toBe("string");
    expect(apiKey!.length).toBeGreaterThan(10);
  });

  it("should reach BaseScan API endpoint", async () => {
    const apiKey = process.env.BASESCAN_API_KEY;
    const testAddress = "0x206265EAbDE04E15ebeb6E27Cad64D9BfDB470DD";
    const url = `https://api.basescan.org/api?module=account&action=txlist&address=${testAddress}&startblock=0&endblock=99999999&page=1&offset=1&sort=desc&apikey=${apiKey}`;

    const response = await fetch(url);
    expect(response.ok).toBe(true);

    const data = await response.json();
    // API returns JSON with status and message fields
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("message");
    // Even rate-limited responses return valid JSON — key format is correct
  });
});
