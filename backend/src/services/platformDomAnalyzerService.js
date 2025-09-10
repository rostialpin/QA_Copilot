import { logger } from '../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export class PlatformDomAnalyzerService {
  constructor() {
    this.platform = null;
    this.connection = null;
  }

  /**
   * Determine how to connect based on platform and context
   */
  async connectToPlatform(options) {
    const { 
      platform, 
      url,           // For web apps
      appPackage,    // For Android
      bundleId,      // For iOS
      appPath,       // For desktop apps
      deviceId,      // For mobile devices
      emulator,      // For emulators
      rokuIP,        // For Roku devices
      appletvIP,     // For Apple TV
      firestickIP    // For Fire TV
    } = options;

    logger.info(`Connecting to platform: ${platform}`);

    switch (platform?.toLowerCase()) {
      case 'web':
      case 'browser':
        return await this.connectToWeb(url);
      
      case 'android':
      case 'android_tv':
        return await this.connectToAndroid({ appPackage, deviceId, emulator });
      
      case 'ios':
      case 'apple_tv':
        return await this.connectToIOS({ bundleId, deviceId, appletvIP });
      
      case 'roku':
        return await this.connectToRoku(rokuIP);
      
      case 'fire_tv':
      case 'firestick':
        return await this.connectToFireTV(firestickIP);
      
      case 'desktop':
        return await this.connectToDesktop(appPath);
      
      default:
        // Try to auto-detect based on provided parameters
        if (url) return await this.connectToWeb(url);
        if (appPackage) return await this.connectToAndroid({ appPackage, deviceId });
        if (bundleId) return await this.connectToIOS({ bundleId, deviceId });
        if (rokuIP) return await this.connectToRoku(rokuIP);
        
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Connect to web application
   */
  async connectToWeb(url) {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    this.platform = 'web';
    this.connection = { browser, page, url };
    
    return {
      platform: 'web',
      connected: true,
      url
    };
  }

  /**
   * Connect to Android/Android TV using ADB and UI Automator
   */
  async connectToAndroid({ appPackage, deviceId, emulator }) {
    try {
      // Check if ADB is available
      await execAsync('adb version');
      
      // List devices if no specific device is provided
      if (!deviceId && !emulator) {
        const { stdout } = await execAsync('adb devices');
        logger.info('Available Android devices:', stdout);
        
        // Parse first available device
        const deviceMatch = stdout.match(/^([\w\d]+)\s+device$/m);
        if (deviceMatch) {
          deviceId = deviceMatch[1];
        } else {
          throw new Error('No Android devices found. Please connect a device or start an emulator.');
        }
      }
      
      // Connect to specific device
      const adbPrefix = deviceId ? `-s ${deviceId}` : '';
      
      // Launch app if package is provided
      if (appPackage) {
        await execAsync(`adb ${adbPrefix} shell monkey -p ${appPackage} 1`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for app to start
      }
      
      // Dump UI hierarchy
      const uiDump = await this.dumpAndroidUI(adbPrefix);
      
      this.platform = 'android';
      this.connection = { 
        deviceId, 
        appPackage, 
        adbPrefix,
        uiDump 
      };
      
      return {
        platform: 'android',
        connected: true,
        deviceId,
        appPackage
      };
    } catch (error) {
      logger.error('Android connection error:', error);
      throw new Error(`Failed to connect to Android: ${error.message}`);
    }
  }

  /**
   * Dump Android UI hierarchy using UI Automator
   */
  async dumpAndroidUI(adbPrefix) {
    try {
      // Dump UI to device
      await execAsync(`adb ${adbPrefix} shell uiautomator dump /sdcard/ui_dump.xml`);
      
      // Pull the dump file
      const localPath = `/tmp/android_ui_dump_${Date.now()}.xml`;
      await execAsync(`adb ${adbPrefix} pull /sdcard/ui_dump.xml ${localPath}`);
      
      // Read and parse the XML
      const xmlContent = await fs.readFile(localPath, 'utf8');
      
      // Clean up
      await fs.unlink(localPath).catch(() => {});
      
      return this.parseAndroidUIXML(xmlContent);
    } catch (error) {
      logger.error('Error dumping Android UI:', error);
      return null;
    }
  }

  /**
   * Parse Android UI XML to extract elements
   */
  parseAndroidUIXML(xmlContent) {
    const elements = [];
    
    // Simple regex parsing (in production, use proper XML parser)
    const nodeRegex = /<node[^>]*>/g;
    const matches = xmlContent.match(nodeRegex) || [];
    
    matches.forEach(nodeStr => {
      const element = {
        attributes: {},
        locators: []
      };
      
      // Extract attributes
      const extractAttr = (name) => {
        const match = nodeStr.match(new RegExp(`${name}="([^"]*)"`));
        return match ? match[1] : null;
      };
      
      element.attributes = {
        'resource-id': extractAttr('resource-id'),
        'class': extractAttr('class'),
        'text': extractAttr('text'),
        'content-desc': extractAttr('content-desc'),
        'clickable': extractAttr('clickable') === 'true',
        'bounds': extractAttr('bounds')
      };
      
      // Generate locators for Android
      if (element.attributes['resource-id']) {
        element.locators.push({
          strategy: 'resource-id',
          value: element.attributes['resource-id'],
          uiautomator: `new UiSelector().resourceId("${element.attributes['resource-id']}")`,
          priority: 1
        });
      }
      
      if (element.attributes.text) {
        element.locators.push({
          strategy: 'text',
          value: element.attributes.text,
          uiautomator: `new UiSelector().text("${element.attributes.text}")`,
          priority: 2
        });
      }
      
      if (element.attributes['content-desc']) {
        element.locators.push({
          strategy: 'content-desc',
          value: element.attributes['content-desc'],
          uiautomator: `new UiSelector().description("${element.attributes['content-desc']}")`,
          priority: 3
        });
      }
      
      if (element.attributes.class) {
        element.locators.push({
          strategy: 'class',
          value: element.attributes.class,
          uiautomator: `new UiSelector().className("${element.attributes.class}")`,
          priority: 4
        });
      }
      
      if (element.locators.length > 0) {
        elements.push(element);
      }
    });
    
    return elements;
  }

  /**
   * Connect to iOS/Apple TV using XCTest or Appium
   */
  async connectToIOS({ bundleId, deviceId, appletvIP }) {
    try {
      // For iOS, we'd typically use Appium or XCTest
      // This is a simplified example
      
      if (appletvIP) {
        // Apple TV connection
        logger.info(`Connecting to Apple TV at ${appletvIP}`);
        // Would require tvOS specific tools
      } else {
        // iPhone/iPad connection
        logger.info(`Connecting to iOS device ${deviceId || 'simulator'}`);
        
        // Check if xcrun is available (macOS only)
        await execAsync('xcrun --version');
        
        // List available simulators
        const { stdout } = await execAsync('xcrun simctl list devices');
        logger.info('Available iOS devices:', stdout);
      }
      
      this.platform = 'ios';
      this.connection = { bundleId, deviceId };
      
      return {
        platform: 'ios',
        connected: true,
        bundleId,
        deviceId
      };
    } catch (error) {
      logger.error('iOS connection error:', error);
      throw new Error(`Failed to connect to iOS: ${error.message}`);
    }
  }

  /**
   * Connect to Roku device
   */
  async connectToRoku(rokuIP) {
    if (!rokuIP) {
      throw new Error('Roku IP address is required');
    }
    
    try {
      // Roku uses ECP (External Control Protocol) over HTTP
      const response = await fetch(`http://${rokuIP}:8060/query/device-info`);
      const deviceInfo = await response.text();
      
      logger.info('Connected to Roku device:', deviceInfo);
      
      // Get current app
      const appResponse = await fetch(`http://${rokuIP}:8060/query/active-app`);
      const activeApp = await appResponse.text();
      
      this.platform = 'roku';
      this.connection = { 
        ip: rokuIP,
        deviceInfo,
        activeApp
      };
      
      return {
        platform: 'roku',
        connected: true,
        ip: rokuIP
      };
    } catch (error) {
      logger.error('Roku connection error:', error);
      throw new Error(`Failed to connect to Roku at ${rokuIP}: ${error.message}`);
    }
  }

  /**
   * Connect to Fire TV/Fire Stick
   */
  async connectToFireTV(firestickIP) {
    if (!firestickIP) {
      throw new Error('Fire TV IP address is required');
    }
    
    try {
      // Fire TV can be connected via ADB over network
      await execAsync(`adb connect ${firestickIP}:5555`);
      
      // Verify connection
      const { stdout } = await execAsync('adb devices');
      if (!stdout.includes(firestickIP)) {
        throw new Error('Failed to connect to Fire TV');
      }
      
      // Dump UI hierarchy
      const uiDump = await this.dumpAndroidUI(`-s ${firestickIP}:5555`);
      
      this.platform = 'firetv';
      this.connection = { 
        ip: firestickIP,
        uiDump
      };
      
      return {
        platform: 'firetv',
        connected: true,
        ip: firestickIP
      };
    } catch (error) {
      logger.error('Fire TV connection error:', error);
      throw new Error(`Failed to connect to Fire TV at ${firestickIP}: ${error.message}`);
    }
  }

  /**
   * Connect to desktop application
   */
  async connectToDesktop(appPath) {
    // For desktop apps, we might use tools like:
    // - Windows: UI Automation, WinAppDriver
    // - macOS: AppleScript, Accessibility Inspector
    // - Linux: AT-SPI, ldtp
    
    logger.info(`Connecting to desktop app: ${appPath}`);
    
    this.platform = 'desktop';
    this.connection = { appPath };
    
    return {
      platform: 'desktop',
      connected: true,
      appPath
    };
  }

  /**
   * Get DOM/UI hierarchy based on platform
   */
  async getUIHierarchy() {
    switch (this.platform) {
      case 'web':
        return await this.getWebDOM();
      
      case 'android':
      case 'firetv':
        return await this.getAndroidUI();
      
      case 'ios':
        return await this.getIOSUI();
      
      case 'roku':
        return await this.getRokuUI();
      
      default:
        throw new Error(`UI hierarchy not implemented for platform: ${this.platform}`);
    }
  }

  /**
   * Get web DOM elements
   */
  async getWebDOM() {
    if (!this.connection?.page) {
      throw new Error('No web page connected');
    }
    
    return await this.connection.page.evaluate(() => {
      // Same implementation as before, extracting DOM elements
      const elements = [];
      const selectors = ['button', 'a', 'input', 'select', '[role="button"]'];
      
      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(node => {
          elements.push({
            tagName: node.tagName,
            text: node.textContent?.trim(),
            id: node.id,
            classes: node.className,
            attributes: {
              'data-testid': node.getAttribute('data-testid'),
              'aria-label': node.getAttribute('aria-label')
            }
          });
        });
      });
      
      return elements;
    });
  }

  /**
   * Get Android UI elements
   */
  async getAndroidUI() {
    if (this.connection?.uiDump) {
      return this.connection.uiDump;
    }
    
    // Re-dump if needed
    const uiDump = await this.dumpAndroidUI(this.connection.adbPrefix);
    this.connection.uiDump = uiDump;
    return uiDump;
  }

  /**
   * Get iOS UI elements (simplified)
   */
  async getIOSUI() {
    // This would typically use XCTest or Appium
    logger.info('iOS UI inspection would require Appium or XCTest setup');
    return [];
  }

  /**
   * Get Roku UI elements
   */
  async getRokuUI() {
    // Roku doesn't expose UI hierarchy directly
    // Would need to use Roku's debugging tools or automation framework
    logger.info('Roku UI inspection requires special debugging setup');
    return [];
  }

  /**
   * Generate test code based on platform
   */
  generatePlatformSpecificLocator(element, platform) {
    switch (platform) {
      case 'web':
        return this.generateWebLocator(element);
      
      case 'android':
      case 'firetv':
        return this.generateAndroidLocator(element);
      
      case 'ios':
        return this.generateIOSLocator(element);
      
      case 'roku':
        return this.generateRokuLocator(element);
      
      default:
        return null;
    }
  }

  generateWebLocator(element) {
    const strategies = [];
    
    if (element.attributes?.['data-testid']) {
      strategies.push(`By.cssSelector("[data-testid='${element.attributes['data-testid']}']")`);
    }
    if (element.id) {
      strategies.push(`By.id("${element.id}")`);
    }
    if (element.text) {
      strategies.push(`By.xpath("//${element.tagName}[contains(text(), '${element.text}')]")`);
    }
    
    return strategies;
  }

  generateAndroidLocator(element) {
    const strategies = [];
    
    if (element.attributes?.['resource-id']) {
      strategies.push(`By.id("${element.attributes['resource-id']}")`);
      strategies.push(`MobileBy.AndroidUIAutomator("new UiSelector().resourceId(\\"${element.attributes['resource-id']}\\"")`);
    }
    if (element.attributes?.text) {
      strategies.push(`MobileBy.AndroidUIAutomator("new UiSelector().text(\\"${element.attributes.text}\\"")`);
    }
    if (element.attributes?.['content-desc']) {
      strategies.push(`By.accessibilityId("${element.attributes['content-desc']}")`);
    }
    
    return strategies;
  }

  generateIOSLocator(element) {
    const strategies = [];
    
    if (element.accessibilityIdentifier) {
      strategies.push(`By.accessibilityId("${element.accessibilityIdentifier}")`);
    }
    if (element.name) {
      strategies.push(`By.name("${element.name}")`);
    }
    
    return strategies;
  }

  generateRokuLocator(element) {
    // Roku uses different navigation paradigm (remote control)
    return [
      `// Navigate using remote: press('OK')`,
      `// Focus element: press('RIGHT') or press('LEFT')`,
      `// Select: press('SELECT')`
    ];
  }

  /**
   * Clean up connections
   */
  async disconnect() {
    if (this.platform === 'web' && this.connection?.browser) {
      await this.connection.browser.close();
    }
    
    if ((this.platform === 'android' || this.platform === 'firetv') && this.connection?.deviceId) {
      // Optionally disconnect ADB
      logger.info(`Disconnected from ${this.platform}`);
    }
    
    this.platform = null;
    this.connection = null;
  }
}

// Export singleton
export const platformDomAnalyzer = new PlatformDomAnalyzerService();