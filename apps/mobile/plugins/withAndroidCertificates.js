const { withAndroidManifest } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to ensure Android trusts user-installed CA certificates
 * and corporate intermediate certificates for bd.crystal-martin.com
 */
module.exports = function withAndroidCertificates(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    const app = androidManifest.application[0];

    // Ensure cleartext and network security config are bound to application
    app.$['android:usesCleartextTraffic'] = 'true';
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config';

    // Write network_security_config.xml during expo prebuild / eas build
    const resXmlDir = path.resolve(
      config.modRequest.platformProjectRoot,
      'app/src/main/res/xml'
    );
    if (!fs.existsSync(resXmlDir)) {
      fs.mkdirSync(resXmlDir, { recursive: true });
    }

    const networkSecurityConfigXml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <!-- Trust pre-installed system certificates -->
            <certificates src="system" />
            <!-- Trust user-installed CA certificates (Settings -> Security -> Install CA certificate) -->
            <certificates src="user" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">bd.crystal-martin.com</domain>
        <domain includeSubdomains="true">crystal-martin.com</domain>
        <domain includeSubdomains="true">192.168.65.50</domain>
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </domain-config>
</network-security-config>
`;

    fs.writeFileSync(
      path.join(resXmlDir, 'network_security_config.xml'),
      networkSecurityConfigXml
    );

    return config;
  });
};

