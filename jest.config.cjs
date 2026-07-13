export default {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  transform: {},
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  }
};
