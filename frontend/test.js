const fs = require('fs');

async function run() {
  try {
    const resAuth = await fetch('http://localhost:3000/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `test-${Date.now()}@test.com`, password: 'Password123!' })
    });
    const cookie = resAuth.headers.get('set-cookie');
    console.log('Auth:', resAuth.status, await resAuth.text(), cookie);

    const payload = {
      sourceList: {
        fileName: "test.csv",
        csv: "Company Name\nexampleee"
      },
      columnMappings: [
        { sourceField: "Company Name", canonicalDataType: "company-name" }
      ],
      configuredOperations: [
        {
          kind: "clean-company-name",
          input: { kind: "source-field", field: "Company Name" },
          generatedField: "exampleee"
        }
      ]
    };

    const res = await fetch('http://localhost:3000/enrichment-jobs', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': cookie 
      },
      body: JSON.stringify(payload)
    });
    console.log('Job:', res.status, await res.text());
  } catch (e) {
    console.error(e);
  }
}
run();
