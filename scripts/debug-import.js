// scripts/debug-import.js
const { User } = require("../src/models/User.model");
const { Department } = require("../src/models/Department.model");

console.log("User:", User);
console.log("User type:", typeof User);
console.log("User keys:", Object.keys(User));
console.log("User prototype:", Object.getPrototypeOf(User));
console.log("Department:", Department);
console.log("Department type:", typeof Department);