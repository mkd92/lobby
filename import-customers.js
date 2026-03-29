/**
 * Customer Import Automation Script
 * 
 * Instructions:
 * 1. Open your application in the browser.
 * 2. Navigate to the Customers page.
 * 3. Open the Browser Console (F12 or Right-click > Inspect > Console).
 * 4. Copy the entire content of this file and paste it into the console.
 * 5. Press Enter.
 */

(async () => {
  const customers = [
    { name: "ABDUL BAGADU MOHAMMED IBRAHIM", phone: "7305315568" },
    { name: "ABINESHKUMAR", phone: "6379315152" },
    { name: "AJAYKUMAR SASTHA SUBRAMANIYAN", phone: "9361568187" },
    { name: "AJEETH A", phone: "8248405278" },
    { name: "ANBURAJ MUTHUSAMY", phone: "6380403893" },
    { name: "ANZIL AHAMMAD N", phone: "7736760363" },
    { name: "ARAVINDHAN P", phone: "9677768847" },
    { name: "ARUL NIXAN ADAIKKALARAJ", phone: "9342974428" },
    { name: "ASWIN ARULDHAS", phone: "7094064830" },
    { name: "CHANDRU BOOPATHI", phone: "9346500469" },
    { name: "DHAYANIDHI M", phone: "9566519990" },
    { name: "F HARITH AHMAD", phone: "9087042271" },
    { name: "FERNANDO", phone: "7010942187" },
    { name: "GANESHKUMAR", phone: "6379829293" },
    { name: "GOPINATH", phone: "9363289618" },
    { name: "HARI DASS V", phone: "9865859628" },
    { name: "HARIKRISHNAN SUNDARESAN", phone: "9788472321" },
    { name: "HARISHKUMAR SAKTHIVEL", phone: "9790254348" },
    { name: "IRULANDI GANESAN", phone: "6381087477" },
    { name: "JAYAKRISHNAN", phone: "6383219068" },
    { name: "KANCHI SURESH BABU", phone: "8977112050" },
    { name: "KARTHI NANJUNDESHWARAN", phone: "8680870081" },
    { name: "KATHIR", phone: "9025504321" },
    { name: "KAVINRAJ MOHANASUNDARAM", phone: "8610397975" },
    { name: "MADAN KUMAR M", phone: "6380668501" },
    { name: "MADHAVAN", phone: "7397659424" },
    { name: "MANIKANDAMOORTHI V", phone: "9342096266" },
    { name: "MANIKANDAN", phone: "" },
    { name: "MOHAN P", phone: "9629758528" },
    { name: "MOHLDOON DASITH AKRAM", phone: "7708442128" },
    { name: "MUKESH", phone: "9345510025" },
    { name: "MURUGAN C", phone: "7305211513" },
    { name: "NAVEEN D", phone: "8248128476" },
    { name: "NITHISH KUMAR M", phone: "7305680897" },
    { name: "P J RINOLD ROSARIO", phone: "8838334227" },
    { name: "PALANI KUMAR AYYAKANNU", phone: "6369768233" },
    { name: "PALANI KUMAR B", phone: "6379484996" },
    { name: "PRADEEP KUMAR", phone: "8012196761" },
    { name: "RAJESH M", phone: "8667837346" },
    { name: "RAJESH YADHAV S", phone: "9361489034" },
    { name: "RAJU MURUGAIYAN", phone: "" },
    { name: "RAMKUMAR RAMESHKUMAR", phone: "9003462350" },
    { name: "SAKTHIVEL", phone: "8925711449" },
    { name: "SAM", phone: "9087759086" },
    { name: "SANJAY KROSHAN", phone: "9751901509" },
    { name: "SARAVANAVEL", phone: "6380138165" },
    { name: "SEKAR", phone: "7373995700" },
    { name: "SELWAKUMAR KRISHNASWAMY", phone: "6383296042" },
    { name: "SENDHAMIZH SELVAN", phone: "8344461662" },
    { name: "SESHATHRI KARUNAMOORTHI", phone: "9443098271" },
    { name: "SHABEEK", phone: "9597760730" },
    { name: "SIRANJEEVI MURUGAN", phone: "8220173279" },
    { name: "SREEJITH S", phone: "8110917224" },
    { name: "SUDHANA SUNDAR", phone: "8925349549" },
    { name: "SURENDAR RAMESH", phone: "8668133078" },
    { name: "SUSHANT PANT", phone: "7895577741" },
    { name: "SYED BADULLA BASHA", phone: "7339195781" },
    { name: "TAMIL", phone: "7010813600" },
    { name: "TAMILSELVAN S", phone: "9600483604" },
    { name: "VENKATAPRASATH R", phone: "9345076997" },
    { name: "VENKATESHWARAN M", phone: "8220822917" },
    { name: "VIGNESHWARAN T", phone: "6382786983" },
    { name: "VINOTH KUMAR D", phone: "9566552239" },
    { name: "VISHNU U", phone: "9745593404" }
  ];

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  /**
   * Helper to set input values in a way that React detects the change
   */
  const setInputValue = (selector, value) => {
    const input = document.querySelector(selector);
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };

  console.log("🚀 Starting Customer Import...");

  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    console.log(`[${i + 1}/${customers.length}] Adding: ${customer.name}`);

    // 1. Navigate to "New Customer" page if not already there
    if (!window.location.pathname.endsWith('/customers/new')) {
      // Specifically target the "New Customer" button in the main content area
      const newBtn = Array.from(document.querySelectorAll('main button, main a')).find(el => 
        el.textContent.includes('New Customer')
      );
      
      if (newBtn) {
        newBtn.click();
      } else {
        // Fallback: programmatic navigation if button not found
        window.location.href = window.location.origin + '/customers/new';
      }
      // Wait for page load/animation
      await sleep(1500); 
    }

    // 2. Fill the form
    const nameSet = setInputValue('main input[name="full_name"]', customer.name);
    const phoneSet = setInputValue('main input[name="phone"]', customer.phone);
    
    // Find the submit button specifically in the main content and with primary-button class
    const submitBtn = Array.from(document.querySelectorAll('main button.primary-button')).find(btn => 
      btn.textContent.includes('Register Customer') || (btn.type === 'submit' && !btn.textContent.includes('Cancel'))
    );

    if (nameSet && submitBtn) {
      submitBtn.click();
      
      // 3. Wait for navigation back to list or for the form to clear
      let waitTime = 0;
      const originalPath = window.location.pathname;
      while (window.location.pathname === originalPath && waitTime < 50) {
        await sleep(100);
        waitTime++;
      }
      
      // Additional buffer for Firestore write and UI transition
      await sleep(800);
    } else {
      console.warn(`⚠️ Could not find form fields for ${customer.name}. Retrying in 2s...`);
      i--; // Retry this customer
      await sleep(2000);
    }
  }

  console.log("✅ FINISHED! All customers have been processed.");
})();
