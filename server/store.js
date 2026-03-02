const fs = require("node:fs");
const path = require("node:path");

const { UPCOMING_SESSIONS } = require("./constants");

const STORE_FILE = path.join(process.cwd(), "data", "store.json");

function getInitialState() {
  return {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    leads: [],
    tutorApplications: [],
    contacts: [],
    activity: [
      {
        id: "ACT-BOOT-1",
        type: "platform",
        message: "TutorHive relaunch stack initialized",
        createdAt: new Date().toISOString()
      }
    ],
    upcomingSessions: UPCOMING_SESSIONS
  };
}

function ensureStore() {
  const directory = path.dirname(STORE_FILE);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify(getInitialState(), null, 2));
    return;
  }

  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const normalized = {
      ...getInitialState(),
      ...parsed,
      leads: Array.isArray(parsed.leads) ? parsed.leads : [],
      tutorApplications: Array.isArray(parsed.tutorApplications)
        ? parsed.tutorApplications
        : [],
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
      activity: Array.isArray(parsed.activity) ? parsed.activity : [],
      upcomingSessions: Array.isArray(parsed.upcomingSessions)
        ? parsed.upcomingSessions
        : UPCOMING_SESSIONS
    };

    if (!parsed.upcomingSessions) {
      normalized.updatedAt = new Date().toISOString();
      fs.writeFileSync(STORE_FILE, JSON.stringify(normalized, null, 2));
    }
  } catch (error) {
    const backupFile = path.join(path.dirname(STORE_FILE), "store.corrupt.backup.json");
    fs.copyFileSync(STORE_FILE, backupFile);
    fs.writeFileSync(STORE_FILE, JSON.stringify(getInitialState(), null, 2));
  }
}

function readStore() {
  ensureStore();
  const raw = fs.readFileSync(STORE_FILE, "utf8");
  return JSON.parse(raw);
}

function writeStore(nextState) {
  const finalState = {
    ...nextState,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(STORE_FILE, JSON.stringify(finalState, null, 2));
  return finalState;
}

function updateStore(mutator) {
  const currentState = readStore();
  const cloned = JSON.parse(JSON.stringify(currentState));
  const mutatedState = mutator(cloned) || cloned;
  return writeStore(mutatedState);
}

module.exports = {
  ensureStore,
  readStore,
  updateStore
};
