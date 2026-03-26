/**
 * BULK CUSTOMER IMPORT SCRIPT
 * 
 * INSTRUCTIONS:
 * 1. Ensure 'supabase' is exposed to the window object in your 'src/supabaseClient.ts':
 *    (window as any).supabase = supabase;
 * 2. Open your app's Customers page in the browser and log in.
 * 3. Open Developer Tools (F12 or Cmd+Option+I) -> Console.
 * 4. Copy and paste this entire script and press Enter.
 */

(async () => {
  const customerData = [
    ["ABDUL BAGADU MOHAMMED IBRAHIM","7305315568"],
    ["ABINESHKUMAR","6379315152"],
    ["AJAYKUMAR SASTHA SUBRAMANIYAN","9361568187"],
    ["AJEETH A","8248405278"],
    ["ANBURAJ MUTHUSAMY","6380403893"],
    ["ANZIL AHAMMAD N","7736760363"],
    ["ARAVINDHAN P","9677768847"],
    ["ARUL NIXAN ADAIKKALARAJ","9342974428"],
    ["ASWIN ARULDHAS","7094064830"],
    ["CHANDRU BOOPATHI","9346500469"],
    ["DHAYANIDHI M","9566519990"],
    ["F HARITH AHMAD","9087042271"],
    ["FERNANDO","7010942187"],
    ["GANESHKUMAR","6379829293"],
    ["GOPINATH","9363289618"],
    ["HARI DASS V","9865859628"],
    ["HARIKRISHNAN SUNDARESAN","9788472321"],
    ["HARISHKUMAR SAKTHIVEL","9790254348"],
    ["IRULANDI GANESAN","6381087477"],
    ["JAYAKRISHNAN","6383219068"],
    ["KANCHI SURESH BABU","8977112050"],
    ["KARTHI NANJUNDESHWARAN","8680870081"],
    ["KATHIR","9025504321"],
    ["KAVINRAJ MOHANASUNDARAM","8610397975"],
    ["MADAN KUMAR M","6380668501"],
    ["MADHAVAN","7397659424"],
    ["MANIKANDAMOORTHI V","9342096266"],
    ["MANIKANDAN",""],
    ["MOHAN P","9629758528"],
    ["MOHLDOON DASITH AKRAM","7708442128"],
    ["MUKESH","9345510025"],
    ["MURUGAN C","7305211513"],
    ["NAVEEN D","8248128476"],
    ["NITHISH KUMAR M","7305680897"],
    ["P J RINOLD ROSARIO","8838334227"],
    ["PALANI KUMAR AYYAKANNU","6369768233"],
    ["PALANI KUMAR B","6379484996"],
    ["PRADEEP KUMAR","8012196761"],
    ["RAJESH M","8667837346"],
    ["RAJESH YADHAV S","9361489034"],
    ["RAJU MURUGAIYAN",""],
    ["RAMKUMAR RAMESHKUMAR","9003462350"],
    ["SAKTHIVEL","8925711449"],
    ["SAM","9087759086"],
    ["SANJAY KROSHAN","9751901509"],
    ["SARAVANAVEL","6380138165"],
    ["SEKAR","7373995700"],
    ["SELWAKUMAR KRISHNASWAMY","6383296042"],
    ["SENDHAMIZH SELVAN","8344461662"],
    ["SESHATHRI KARUNAMOORTHI","9443098271"],
    ["SHABEEK","9597760730"],
    ["SIRANJEEVI MURUGAN","8220173279"],
    ["SREEJITH S","8110917224"],
    ["SUDHANA SUNDAR","8925349549"],
    ["SURENDAR RAMESH","8668133078"],
    ["SUSHANT PANT","7895577741"],
    ["SYED BADULLA BASHA","7339195781"],
    ["TAMIL","7010813600"],
    ["TAMILSELVAN S","9600483604"],
    ["VENKATAPRASATH R","9345076997"],
    ["VENKATESHWARAN M","8220822917"],
    ["VIGNESHWARAN T","6382786983"],
    ["VINOTH KUMAR D","9566552239"],
    ["VISHNU U","9745593404"]
  ];

  const client = window.supabase; 
  if (!client) {
    console.error("Supabase client not found on 'window.supabase'. Please expose it in src/supabaseClient.ts first.");
    return;
  }

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    console.error("No authenticated user found. Make sure you are logged in to the app.");
    return;
  }

  console.log(`🚀 Starting import of ${customerData.length} customers...`);

  const payload = customerData.map(([name, phone]) => ({
    full_name: name.trim(),
    phone: phone.trim(),
    owner_id: user.id,
    email: ""
  }));

  const { data, error } = await client
    .from('tenants')
    .insert(payload);

  if (error) {
    console.error("❌ Import failed:", error);
  } else {
    console.log("✅ Successfully imported all customers! Refresh the page to see them.");
  }
})();
