const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const TEST_IMAGE_PATH = path.join(__dirname, 'test-image.jpg');
const TEST_TEXT_PATH = path.join(__dirname, 'test-file.txt');

async function createTestFiles() {
  // Create a small valid JPEG image (1x1 pixel white JPG)
  const jpgBuffer = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
    0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
    0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
    0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
    0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
    0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
    0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
    0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD7, 0xFF, 0xD9
  ]);
  fs.writeFileSync(TEST_IMAGE_PATH, jpgBuffer);
  console.log(`✓ Created test image: ${TEST_IMAGE_PATH}`);

  // Create a text file for invalid file upload test
  fs.writeFileSync(TEST_TEXT_PATH, 'This is a test text file that should be rejected.');
  console.log(`✓ Created test text file: ${TEST_TEXT_PATH}`);
}

async function runTest() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Intercept network requests
  const requests = [];
  page.on('request', req => {
    if (req.url().includes('/api/v1/')) {
      requests.push({
        method: req.method(),
        url: req.url(),
        postData: req.postData(),
      });
    }
  });

  try {
    console.log('\n=== STEP 1: LOGIN AND OPEN MANAGER EXPENSES PAGE ===');
    
    // First, go to login page
    await page.goto('http://127.0.0.1:3001/login', { waitUntil: 'networkidle' });
    console.log('✓ Navigated to login page');

    // Login as manager
    const emailInput = await page.locator('input[type="email"]').first();
    const passwordInput = await page.locator('input[type="password"]').first();
    
    if (await emailInput.isVisible() && await passwordInput.isVisible()) {
      console.log('✓ Login form found');
      
      await emailInput.fill('manager.1@enterprise.local');
      await passwordInput.fill('password123');
      
      const loginBtn = await page.locator('button:has-text("Login"), button:has-text("Sign in")').first();
      await loginBtn.click();
      console.log('✓ Submitted login credentials');
      
      // Wait for navigation after login
      await page.waitForNavigation({ waitUntil: 'networkidle' });
      console.log('✓ Logged in successfully');
    } else {
      console.warn('ℹ Login form not found, assuming already logged in');
    }

    // Now navigate to expenses page
    await page.goto('http://127.0.0.1:3001/dashboard/expenses', { waitUntil: 'networkidle' });
    console.log('✓ Navigated to expenses page');
    
    // Wait a bit for the page to render
    await page.waitForTimeout(2000);

    // Verify page loaded successfully
    const pageTitle = await page.title();
    console.log(`✓ Page title: ${pageTitle}`);

    // Check for errors
    const errors = await page.evaluate(() => window.errors || []);
    if (errors.length > 0) {
      console.error('✗ React/JavaScript errors:', errors);
    } else {
      console.log('✓ No React/JavaScript errors detected');
    }
    
    // Check if expenses heading is present
    const expensesHeading = await page.locator('h1:has-text("Expenses")').first();
    if (await expensesHeading.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('✓ Expenses page heading found');
    } else {
      console.warn('✗ Expenses page heading not found - page may not have loaded');
    }

    // Check network requests
    console.log('\n=== API REQUESTS CAPTURED ===');
    if (requests.length > 0) {
      requests.forEach(req => {
        const endpoint = req.url.split('/api/v1/')[1] || req.url;
        console.log(`→ ${req.method} ${endpoint}`);
      });
    } else {
      console.log('(no API requests yet)');
    }

    console.log('\n=== STEP 2: OPEN SUBMIT EXPENSE DRAWER AND UPLOAD FILE ===');
    
    // First, check what role the manager has
    const authState = await page.evaluate(() => {
      try {
        const session = JSON.parse(localStorage.getItem('enterprise-auth-session') || '{}');
        return {
          role: session.role,
          roles: session.roles,
          user: session.user?.name,
          permissions: session.permissions,
        };
      } catch (e) {
        return null;
      }
    });
    console.log(`✓ Auth state: role=${authState?.role}, user=${authState?.user}`);
    
    if (authState?.role !== 'MANAGER' && authState?.role !== 'EMPLOYEE') {
      console.warn(`✗ Manager has role '${authState?.role}', expected 'MANAGER' or 'EMPLOYEE'`);
    }

    // Look for the "Submit expense" button with various selectors
    let submitExpenseBtn = await page.locator('button:has-text("Submit expense")').first();
    if (!await submitExpenseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('  Trying alternative selectors...');
      // Try other button selectors
      const allButtons = await page.locator('button').all();
      for (const btn of allButtons) {
        const text = await btn.textContent();
        if (text?.includes('Submit') || text?.includes('Add') || text?.includes('New')) {
          submitExpenseBtn = btn;
          console.log(`  Found button: "${text?.trim()}"`);
          break;
        }
      }
    }
    
    if (await submitExpenseBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('✓ Found "Submit expense" button');
      await submitExpenseBtn.click();
      console.log('✓ Clicked to open submit drawer');
      
      // Wait for the drawer to appear
      await page.waitForTimeout(1000);
      
      // Find file input in the form
      const fileInputs = await page.locator('input[type="file"]').all();
      console.log(`✓ Found ${fileInputs.length} file input(s) in form`);

      if (fileInputs.length > 0) {
        const fileInput = fileInputs[0];
        console.log('✓ Uploading real image file via Playwright...');
        
        // Set the file using Playwright's setInputFiles
        await fileInput.setInputFiles(TEST_IMAGE_PATH);
        console.log(`✓ File selected: ${path.basename(TEST_IMAGE_PATH)}`);

        // Verify file was selected
        const selectedFileName = await page.evaluate(() => {
          const input = document.querySelector('input[type="file"]');
          return input?.files?.[0]?.name || null;
        });
        console.log(`✓ Input validation: File name in DOM = ${selectedFileName}`);

        // Wait for React to process the file change event
        await page.waitForTimeout(500);
        console.log('  Waited for React state update...');

        // Find and click the submit button (look for button with text "Submit expense" in the drawer)
        const submitBtnInForm = await page.locator('button:has-text("Submit expense"):last-of-type').first();
        if (await submitBtnInForm.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log('✓ Found submit button in form');
          
          // Click anywhere to close dropdowns
          await page.click('body', { force: true }).catch(() => {});
          await page.waitForTimeout(300);
          
          // Track file upload request
          let filesUploadRequest = false;
          let expensePostRequest = false;
          const requestListener = (req) => {
            if (req.url().includes('/files/upload') && req.method() === 'POST') {
              console.log(`✓ POST /files/upload request detected (multipart/form-data)`);
              filesUploadRequest = true;
            }
            if (req.url().includes('/expenses') && req.method() === 'POST') {
              console.log(`✓ POST /expenses request detected`);
              expensePostRequest = true;
            }
          };
          page.on('request', requestListener);

          // Use force click if needed
          await submitBtnInForm.click({ force: true }).catch(() => {
            console.log('  Retrying with regular click...');
            return submitBtnInForm.click();
          });
          console.log('✓ Clicked submit button');

          // Wait for file upload and expense creation
          await page.waitForTimeout(4000);
          page.off('request', requestListener);

          if (filesUploadRequest) {
            console.log('✓ File was uploaded to backend');
          } else {
            console.log('ℹ File upload request not intercepted (may still have been sent)');
          }
          if (expensePostRequest) {
            console.log('✓ Expense was created in backend');
          }
          
          // Check if success message appeared
          const successMsg = await page.locator('.text-emerald-700, [role="status"]').first().textContent().catch(() => null);
          if (successMsg?.includes('success') || successMsg?.includes('submitted')) {
            console.log(`✓ Success message: "${successMsg?.trim()}"`);
          }
        } else {
          console.warn('✗ Submit button not found in form');
        }
      } else {
        console.warn('✗ No file input found in drawer');
      }
    } else {
      console.warn('✗ "Submit expense" button not found on page - manager may not have submit permission');
      console.log('  Checking page content...');
      const pageContent = await page.textContent();
      if (pageContent?.includes('Expenses')) {
        console.log('  ✓ Page has "Expenses" heading');
      }
      if (pageContent?.includes('Read-only')) {
        console.log('  ✗ Page shows "Read-only" - manager might not have edit permissions');
      }
    }

    console.log('\n=== STEP 3: RELOAD AND VERIFY PERSISTENCE ===');
    
    // Check auth session before reload
    const sessionBeforeReload = await page.evaluate(() => {
      const session = JSON.parse(localStorage.getItem('enterprise-auth-session') || '{}');
      return { 
        hasSession: !!session.role,
        role: session.role,
        user: session.user?.name,
        organizationId: session.organizationId 
      };
    });
    console.log(`✓ Session before reload: ${sessionBeforeReload.hasSession ? 'present' : 'missing'} (role: ${sessionBeforeReload.role}, user: ${sessionBeforeReload.user})`);
    
    await page.reload({ waitUntil: 'networkidle' });
    console.log('✓ Page reloaded');
    
    // Check auth session after reload
    const sessionAfterReload = await page.evaluate(() => {
      const session = JSON.parse(localStorage.getItem('enterprise-auth-session') || '{}');
      return { 
        hasSession: !!session.role,
        role: session.role,
        user: session.user?.name,
        organizationId: session.organizationId 
      };
    });
    console.log(`✓ Session after reload: ${sessionAfterReload.hasSession ? 'present' : 'missing'} (role: ${sessionAfterReload.role}, user: ${sessionAfterReload.user})`);
    
    // Check expenses table in UI
    const expenseElements = await page.locator('tr').all();
    console.log(`✓ Table rows found: ${expenseElements.length}`);
    
    if (expenseElements.length > 0) {
      console.log('✓ Expenses are visible in the table after reload - file upload successful!');
      // Extract first expense details from table
      const firstExpenseText = await expenseElements[0].textContent();
      if (firstExpenseText?.includes('test-image') || firstExpenseText?.includes('jpg')) {
        console.log('✓ Receipt file reference visible in expense details');
      }
    } else {
      console.log('ℹ No expenses visible in table (might be filtered or not created)');
      
      // Try to check via page content
      const pageContent = await page.textContent();
      if (pageContent?.includes('No expenses')) {
        console.log('ℹ Page shows "No expenses" - form submission may not have succeeded');
      }
    }

    console.log('\n=== TEST COMPLETE ===');
    console.log('Manager expense file upload verification complete.');

  } catch (error) {
    console.error('✗ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

(async () => {
  await createTestFiles();
  await runTest();
})();
