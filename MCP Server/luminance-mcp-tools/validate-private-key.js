/**
 * Validate private key format for JWT Bearer authentication
 */

const { createSign } = require("crypto");

// Test private key validation
function validatePrivateKey(privateKey) {
  console.log("🔍 Validating Private Key Format...\n");

  console.log("📋 Basic Checks:");
  console.log(`   Length: ${privateKey.length} characters`);
  console.log(`   First 50 chars: ${privateKey.substring(0, 50)}`);
  console.log(`   Last 50 chars: ${privateKey.substring(privateKey.length - 50)}`);

  // Check for required headers
  const hasBeginHeader = privateKey.includes("-----BEGIN PRIVATE KEY-----");
  const hasEndHeader = privateKey.includes("-----END PRIVATE KEY-----");

  console.log(`   Has BEGIN header: ${hasBeginHeader ? '✅' : '❌'}`);
  console.log(`   Has END header: ${hasEndHeader ? '✅' : '❌'}`);

  if (!hasBeginHeader || !hasEndHeader) {
    console.log("   ❌ Missing required PEM headers");
    return false;
  }

  // Check for common issues
  const hasExtraSpaces = privateKey.includes("  ") || privateKey.startsWith(" ") || privateKey.endsWith(" ");
  console.log(`   Has extra spaces: ${hasExtraSpaces ? '⚠️ ' : '✅'}`);

  const lineCount = privateKey.split('\n').length;
  console.log(`   Line count: ${lineCount}`);

  // Check for proper line structure
  const lines = privateKey.split('\n').filter(line => line.trim() !== '');
  console.log(`   Non-empty lines: ${lines.length}`);

  if (lines.length < 3) {
    console.log("   ❌ Too few lines - key might be malformed");
    return false;
  }

  console.log("\n🧪 Testing Cryptographic Operations...");

  try {
    // Test signing with the private key
    const testData = "test";
    const signature = createSign("RSA-SHA256")
      .update(testData)
      .sign(privateKey, "base64");

    console.log("   ✅ Private key can sign data successfully!");
    console.log(`   Test signature: ${signature.substring(0, 50)}...`);
    return true;

  } catch (error) {
    console.log(`   ❌ Cryptographic test failed: ${error.message}`);

    if (error.message.includes("DECODER routines")) {
      console.log("\n🔧 Decoder Error Solutions:");
      console.log("   1. Remove any extra spaces before/after the key");
      console.log("   2. Ensure proper line endings (Unix \\n, not Windows \\r\\n)");
      console.log("   3. Try single-line format (replace \\n with actual newlines)");
      console.log("   4. Regenerate the key if still issues");
    }

    return false;
  }
}

// Instructions
console.log("📝 Instructions:");
console.log("1. Copy your EXACT private key from the file");
console.log("2. Replace the PLACEHOLDER below with your key");
console.log("3. Run: node validate-private-key.js");
console.log("4. If validation passes, use that exact format in Prismatic\n");

// REPLACE THIS WITH YOUR ACTUAL PRIVATE KEY
const YOUR_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDSqtrcpAk1OjOY
V0BPXDtWvuTsNEKdxOOhvIutpshbwslNrvf0OKL6GrzCe+aMXsYutBbEyzIUzB3p
Oeh7y7cazuWgP7oiz49Qx8txnvCcVXjtFJPzHagbXZq+gaknJw4cZbHo7BqnBpF6
IInBDIVzmcGZwCqRnTrZANg4qLm2RYAnB7SLgOB5y7We2wPitmFWkTOl+1uFIhSm
/yjGie7aE0pAFEqscjk5G6uifnzkaWhmuFuxcpivEed6Kf3ItzUFC/mBXZfWHS5O
lFd43ja84At9aTHpH2AC8yKdJrYzSnAJ0RUxLaXq9Q5iR/ZxVEUqZEstqAP669kA
JTVnl4AvAgMBAAECggEABYLIV60j9L7jL9u8csU8gF5Ay82wnm2Z0+wEPH8tskFB
XPN7LD9HtJf6y46FL0Gg/FfkA+vEn6xRtRnkMy26dP49Vr/EBUFvSwwuDhUfXd+T
L/gOOhJhCK6scuZXTiuA/JsS32oGLgSyPvvJB56en04liofSw3mcvqW2SWWYFaSt
EQI3GVoz83G6VCtV9r7EH+a6Lx3ifLipVoceR57ejsmX+PXg0bhmlh0buIBuLuJ2
gtIraxPq2wilnLoJ51DkGow3zc4liCHofAsY0Cvn0mry0xx/RlvWRY+x+T6iTeV4
ii61AG9qjSmKOS2PWIp1tVmL1hyYwxdSlUMMPK7KUQKBgQD1ZOZagt2akxTTBKdi
Sqomm++QlCCj2yvHGzXRrSDl3cdLXtpuwEHqoelGu//q2Q1dRxuZkH6VfouvKFRm
0kP4KdOYZdcvSmBNQp1FX4FVPinzSXaQf5FE/0BrNln1PTczACnnZM6Q+bsli2Xn
Atl1TU1pRSbxy0gdQtcTKt2BvwKBgQDbxbrmLD9+5XF91QLKY40CBvMwQzqeMDL4
MgyQnq01TZsywO2JlrWKnemKUIibDmx8FiDO6sXhlQ+I/YKJoM9kISWxx9pLgIfm
uFKxvqpW9OcR5cDZDIJjk41a7/JLEKv/m/y7GJKAS3ZpSKrZIxmW6IIC72ISaCvM
xlP9oGm9kQKBgQDUForI+4YQDMLYxpLsbt+0Ut2wtXWoaMrjYO8Y82sVgKK4z5g2
VFAkPB/kFKRRE5trXQPLq4jcJ+0OS+r2mxBHsc7BTnO22a911vcaeDrNs9aKAJpK
tRaW7Y19nBIP1QKaP6/337ZwsoY/IsXF7T6JFXCsZSoNnMYNFDHSzR94/QKBgD+u
Zd+4RpXQijg59tsKSZuiw+jiMiQQN1Svu/BT6kCdwjDMsofBwczuwPMxLsQvQ8QY
7VzHrpsVBDFfs+mJTU7oQ/HlxR1HmxmBo4SZiOY1hJctCdpaw5Vy9ey5xm114UDp
xCu6jQjb1O3g/pB4mTufF70d/D71LGvjtAaz6q/hAoGAdDKbeLl5++MqE3Z00YNz
sMhzUBvh1V1FuBVg1FWSuMTFN7EmnH3jynx6iJ3lgQfibi0RGbYBG4kUYfxleXIR
g3HFi/gDVegweYQ5jPSoi6/Thf7iB9Bl8GMjoE2Oi4jYms7UM/8UGSXWK6NKRuOj
tIPZOBxjSpIl/YRINtgF0gI=
-----END PRIVATE KEY-----`;

// Only run validation if key was replaced
if (!YOUR_PRIVATE_KEY.includes("REPLACE_WITH")) {
  const isValid = validatePrivateKey(YOUR_PRIVATE_KEY);

  if (isValid) {
    console.log("\n🎉 Private key validation successful!");
    console.log("✅ Use this exact format in Prismatic configuration");
  } else {
    console.log("\n❌ Private key validation failed");
    console.log("🔧 Fix the issues above and try again");
  }
} else {
  console.log("⚠️  Please replace the placeholder with your actual private key first!");
}