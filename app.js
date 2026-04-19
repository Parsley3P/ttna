// Wait for the DOM to fully load before attaching event listeners
document.addEventListener("DOMContentLoaded", async () => {
  // Cache DOM elements for easy access
  const elements = {
    loading: document.getElementById("loading"),
    quizContent: document.getElementById("quiz-content"),
    completionMessage: document.getElementById("completion-message"),
    questionText: document.getElementById("question-text"),
    optionsContainer: document.getElementById("options-container"),
    feedback: document.getElementById("feedback"),
    nextBtn: document.getElementById("nextBtn"),
    exportBtn: document.getElementById("exportBtn"),
    importFile: document.getElementById("importFile"),
    resetBtn: document.getElementById("resetBtn")
  };

  let currentQuestion = null; // Tracks the question currently displayed

  // Initialize the database structure and data (from db.js)
  await initDB();
  // Load the first unanswered question
  await loadNextQuestion();

  /**
   * Queries IndexedDB for progress, matches against questions, 
   * and loads the first unanswered question into the UI.
   */
  async function loadNextQuestion() {
    // Reset views
    elements.loading.classList.remove("hidden");
    elements.quizContent.classList.add("hidden");
    elements.completionMessage.classList.add("hidden");

    try {
      // 1. Fetch all progress records
      const progressRecords = await db.progress.toArray();
      const answeredIds = progressRecords.map(record => record.questionId);

      // 2. Fetch all questions 
      const questions = await db.questions.toArray();
      
      // 3. Find the first question whose ID is NOT in the answered list
      currentQuestion = questions.find(q => !answeredIds.includes(q.id));

      if (currentQuestion) {
        renderQuestion(currentQuestion);
      } else {
        // All questions completed
        elements.loading.classList.add("hidden");
        elements.completionMessage.classList.remove("hidden");
      }
    } catch (error) {
      console.error("Failed to load question:", error);
      elements.loading.textContent = "Error loading question. Please refresh.";
    }
  }

  /**
   * Updates the DOM to display the selected question and its choices.
   */
  function renderQuestion(question) {
    elements.questionText.textContent = question.questionText;
    elements.optionsContainer.innerHTML = ""; // Clear old options
    
    // Reset states
    elements.feedback.classList.add("hidden");
    elements.nextBtn.classList.add("hidden");
    elements.nextBtn.disabled = true;

    // Iterate over the options object to create dynamic buttons
    for (const [key, value] of Object.entries(question.options)) {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = `${key}. ${value}`;
      btn.dataset.key = key; 
      
      // Attach click event to handle the user's choice
      btn.addEventListener("click", () => handleOptionClick(btn, key, question.correctAnswer));
      elements.optionsContainer.appendChild(btn);
    }

    // Reveal the UI
    elements.loading.classList.add("hidden");
    elements.quizContent.classList.remove("hidden");
  }

  /**
   * Evaluates the answer, updates UI with feedback, and saves to IndexedDB.
   */
  async function handleOptionClick(selectedBtn, selectedKey, correctKey) {
    // 1. Lock all option buttons to prevent multiple answers
    const allBtns = elements.optionsContainer.querySelectorAll(".option-btn");
    allBtns.forEach(btn => btn.disabled = true);

    const isCorrect = (selectedKey === correctKey);

    // 2. Apply visual styles based on correctness
    if (isCorrect) {
      selectedBtn.classList.add("correct");
      elements.feedback.textContent = "Correct!";
      elements.feedback.className = "feedback-correct";
    } else {
      selectedBtn.classList.add("incorrect");
      elements.feedback.textContent = "Incorrect.";
      elements.feedback.className = "feedback-incorrect";

      // Highlight the actual correct answer in green
      const correctBtn = Array.from(allBtns).find(btn => btn.dataset.key === correctKey);
      if (correctBtn) correctBtn.classList.add("correct");
    }

    elements.feedback.classList.remove("hidden");

    // 3. Save the result to our 'progress' table in IndexedDB
    try {
      await db.progress.put({
        questionId: currentQuestion.id,
        isCorrect: isCorrect
      });
    } catch (error) {
      console.error("Failed to save progress:", error);
    }

    // 4. Enable "Next Question"
    elements.nextBtn.disabled = false;
    elements.nextBtn.classList.remove("hidden");
  }

  // Next Question trigger
  elements.nextBtn.addEventListener("click", loadNextQuestion);

  // ==========================================
  // EXPORT / IMPORT LOGIC
  // ==========================================

  /**
   * Retrieves 'progress' table data, serializes to JSON, and triggers a download.
   */
  elements.exportBtn.addEventListener("click", async () => {
    try {
      const progressData = await db.progress.toArray();
      const jsonStr = JSON.stringify(progressData, null, 2);
      
      // Create a Blob to trigger the download
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = "quiz_progress.json";
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export progress.");
    }
  });

  /**
   * Reads a JSON file, parses it, and overwrites the 'progress' table.
   */
  elements.importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        
        // Validation: Verify it is a valid JSON array
        if (!Array.isArray(importedData)) {
          throw new Error("Invalid format. Expected JSON array.");
        }

        // Overwrite existing progress
        await db.progress.clear();
        await db.progress.bulkAdd(importedData);
        
        alert("Progress imported successfully!");
        
        // Reload UI
        await loadNextQuestion();
      } catch (error) {
        console.error("Import failed:", error);
        alert("Failed to import progress. Invalid JSON file.");
      }
      
      // Reset input to allow re-uploading the same file
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  // Optional tool for testing purposes
  if(elements.resetBtn) {
    elements.resetBtn.addEventListener("click", async () => {
      if(confirm("Are you sure you want to erase all local progress?")) {
        await db.progress.clear();
        await loadNextQuestion();
      }
    });
  }
});
