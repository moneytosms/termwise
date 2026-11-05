export type Persona = { email: string; name: string; role: string; campus: string };

// Demo logins offered on the sign-in page. Password is termwise-demo for all of them.
export const PERSONAS: Persona[] = [
  { email: "eng.admin@termwise.demo", name: "Sunita Rath", role: "Office admin", campus: "Engineering College" },
  { email: "cse.faculty@termwise.demo", name: "Bibhu Prasad Sahoo", role: "Faculty", campus: "Engineering College" },
  { email: "cse.faculty2@termwise.demo", name: "Madhusmita Nayak", role: "Faculty", campus: "Engineering College" },
  { email: "me.faculty@termwise.demo", name: "Ranjan Kumar Jena", role: "Faculty", campus: "Engineering College" },
  { email: "subhashree.mohanty@termwise.demo", name: "Subhashree Mohanty", role: "Student", campus: "Engineering College" },
  { email: "prakash.mohanty@termwise.demo", name: "Prakash Mohanty", role: "Parent", campus: "Engineering College" },
  { email: "ankit.panda@termwise.demo", name: "Ankit Panda", role: "Student", campus: "Engineering College" },
  { email: "sarat.panda@termwise.demo", name: "Sarat Panda", role: "Parent", campus: "Engineering College" },
  { email: "pallavi.jena@termwise.demo", name: "Pallavi Jena", role: "Parent", campus: "Engineering College" },
  { email: "mgt.admin@termwise.demo", name: "Lopamudra Das", role: "Office admin", campus: "Management School" },
  { email: "mba.faculty@termwise.demo", name: "Sandeep Mishra", role: "Faculty", campus: "Management School" },
  { email: "farheen.ali@termwise.demo", name: "Farheen Ali", role: "Student", campus: "Management School" },
  { email: "imran.ali@termwise.demo", name: "Imran Ali", role: "Parent", campus: "Management School" },
  { email: "phr.admin@termwise.demo", name: "Sasmita Behera", role: "Office admin", campus: "Pharmacy College" },
  { email: "phr.faculty@termwise.demo", name: "Debasis Mohapatra", role: "Faculty", campus: "Pharmacy College" },
  { email: "phr.faculty2@termwise.demo", name: "Itishree Swain", role: "Faculty", campus: "Pharmacy College" },
  { email: "trust@termwise.demo", name: "Bijay Mishra", role: "Trust", campus: "All campuses" },
];
