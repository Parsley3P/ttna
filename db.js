// Initialize a new Dexie database named "QuizAppDB"
const db = new Dexie("QuizAppDB");

// Define the database schema.
// We use 2 tables:
// 1. "questions" - Stores static test data. 'id' is the primary key.
// 2. "progress" - Stores user answers. 'questionId' is the primary key.
db.version(1).stores({
  questions: "id, questionText", 
  progress: "questionId, isCorrect"
});

// The current version of our data payload. 
// Incrementing this in future updates will force the app to re-fetch questions.json.
const DATA_VERSION = 2;

/**
 * Initializes the database content.
 * Checks localStorage against DATA_VERSION. If outdated/missing, fetches questions.json,
 * clears the existing questions, and performs a bulk insert.
 */
async function initDB() {
  const currentVersion = localStorage.getItem("currentDataVersion");

  // Check if we need to fetch new data
  if (!currentVersion || parseInt(currentVersion) < DATA_VERSION) {
    try {
      console.log("Fetching questions from JSON and seeding the database...");
      
      // Fetch the static JSON file
      const response = await fetch("./questions.json");
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const questionsData = await response.json();

      // Clear the questions table to avoid duplicates or orphaned old data
      await db.questions.clear();
      
      // Bulk insert the fetched data into the 'questions' table
      await db.questions.bulkAdd(questionsData);

      // Update the version in localStorage so we don't re-fetch on the next reload
      localStorage.setItem("currentDataVersion", DATA_VERSION);
      console.log("Database seeded successfully.");
      
    } catch (error) {
      console.error("Error initializing database:", error);
    }
  } else {
    console.log("Database is up to date. Loading directly from IndexedDB.");
  }
}
