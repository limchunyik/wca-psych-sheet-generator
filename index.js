let persons = [];

// load stored persons on page load
function loadStoredPersons() {
  const stored = localStorage.getItem("wcaPersons");
  if (stored) {
    persons = JSON.parse(stored);
    console.log("Loaded stored persons:", persons);
  }
}

// save persons to localStorage
function savePersons() {
  localStorage.setItem("wcaPersons", JSON.stringify(persons));
}

// remove individual competitors
function removePerson(wcaId) {
  persons = persons.filter((id) => id !== wcaId);
  savePersons();
  showNotification(`Removed ${wcaId}`, "info");

  // refresh the display if it's currently showing
  const rankDisplay = document.getElementById("rankDisplay");
  if (
    rankDisplay.innerHTML.trim() !== "" &&
    !rankDisplay.innerHTML.includes("Loading")
  ) {
    displayRanks();
  }
}

async function addWCAId() {
  try {
    const wcaId = document.getElementById("wcaId").value.toUpperCase();
    const response = await fetch(
      `https://raw.githubusercontent.com/robiningelbrecht/wca-rest-api/master/api/persons/${wcaId}.json`
    );

    if (!response.ok) {
      throw new Error("WCA ID does not exist");
    }

    if (!persons.includes(wcaId)) {
      persons.push(wcaId);
      savePersons(); // save to localStorage after adding
      showNotification(`Added ${wcaId} successfully!`, "success");
    } else {
      showNotification(`${wcaId} already added!`, "info");
    }

    document.getElementById("wcaId").value = "";
  } catch (error) {
    console.log(error);
    showNotification(error.message, "error");
    document.getElementById("wcaId").value = "";
  }
}

function updateProgress(completed, total) {
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");

  if (progressBar && progressText) {
    const percentage = (completed / total) * 100;
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `${completed} / ${total} competitors loaded`;
  }
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (i === retries)
        throw new Error(`Failed after ${retries + 1} attempts`);
    } catch (error) {
      if (i === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
    }
  }
}

async function displayRanks() {
  const rankDisplay = document.getElementById("rankDisplay");
  const selectedEvent = document.getElementById("event").value;

  // loading state with progress
  rankDisplay.innerHTML = `
    <div class="p-8 text-center">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-gray-600">Loading rankings...</p>
      <div class="mt-4 bg-gray-200 rounded-full h-2 w-64 mx-auto">
        <div id="progressBar" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
      </div>
      <p id="progressText" class="text-sm text-gray-500 mt-2">0 / ${persons.length} competitors loaded</p>
    </div>
  `;

  try {
    let results = [];
    let completed = 0;

    // create all fetch promises at once
    const fetchPromises = persons.map(async (wcaId) => {
      try {
        const response = await fetchWithRetry(
          `https://raw.githubusercontent.com/robiningelbrecht/wca-rest-api/master/api/persons/${wcaId}.json`
        );

        if (response.ok) {
          const data = await response.json();

          const single =
            data.rank.singles.find((event) => event.eventId === selectedEvent)
              ?.best || null;
          const average =
            data.rank.averages.find((event) => event.eventId === selectedEvent)
              ?.best || null;

          // Update progress
          completed++;
          updateProgress(completed, persons.length);

          return {
            name: data.name,
            wcaId: wcaId,
            single: single,
            average: average,
            success: true,
          };
        } else {
          completed++;
          updateProgress(completed, persons.length);
          console.warn(`Failed to fetch data for ${wcaId}`);
          return { wcaId, success: false };
        }
      } catch (error) {
        completed++;
        updateProgress(completed, persons.length);
        console.error(`Error fetching ${wcaId}:`, error);
        return { wcaId, success: false };
      }
    });

    // wait for all requests to complete
    const allResults = await Promise.all(fetchPromises);

    // filter out failed requests
    results = allResults.filter((result) => result.success);

    // sorting logic with proper tiebreaking
    results.sort((a, b) => {
      const blindfoldedEvents = ["333bf", "444bf", "555bf"];

      if (blindfoldedEvents.includes(selectedEvent)) {
        const timeA = a.single || Infinity;
        const timeB = b.single || Infinity;
        return timeA - timeB;
      } else {
        const hasAverageA = a.average !== null;
        const hasAverageB = b.average !== null;

        if (hasAverageA && !hasAverageB) return -1;
        if (!hasAverageA && hasAverageB) return 1;

        if (hasAverageA && hasAverageB) {
          if (a.average === b.average) {
            const singleA = a.single || Infinity;
            const singleB = b.single || Infinity;
            return singleA - singleB;
          }
          return a.average - b.average;
        }

        const singleA = a.single || Infinity;
        const singleB = b.single || Infinity;
        return singleA - singleB;
      }
    });

    // display results
    displayResults(results, selectedEvent);
  } catch (error) {
    console.error("Error in batch processing:", error);
    rankDisplay.innerHTML = `
      <div class="p-8 text-center">
        <div class="text-red-500 text-xl mb-2">⚠️</div>
        <p class="text-gray-600">Error loading rankings. Please try again.</p>
      </div>
    `;
  }
}

// separate function for displaying results
function displayResults(results, selectedEvent) {
  const rankDisplay = document.getElementById("rankDisplay");

  // get event name for display
  const eventNames = {
    333: "3x3",
    222: "2x2",
    444: "4x4",
    555: "5x5",
    666: "6x6",
    777: "7x7",
    "333bf": "3BLD",
    "333fm": "FMC",
    "333oh": "OH",
    clock: "Clock",
    minx: "Megaminx",
    pyram: "Pyraminx",
    skewb: "Skewb",
    sq1: "Square-1",
    "444bf": "4BLD",
    "555bf": "5BLD",
    "333mbf": "MBLD",
  };

  let htmlContent = `
    <div class="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
      <h3 class="text-xl font-bold text-gray-800">Results for ${
        eventNames[selectedEvent]
      }</h3>
      <p class="text-sm text-gray-600 mt-1">Comparing ${
        results.length
      } competitor${results.length !== 1 ? "s" : ""}</p>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full">
        <thead class="bg-gradient-to-r from-gray-100 to-gray-200">
          <tr>
            <th class="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Rank</th>
            <th class="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Name</th>
            <th class="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">WCA ID</th>
            <th class="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Single</th>
            <th class="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Average</th>
            <th class="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
  `;

  if (results.length === 0) {
    htmlContent += `
      <tr>
        <td colspan="6" class="px-6 py-8 text-center text-gray-500">
          No results found for this event. Try adding some WCA IDs first!
        </td>
      </tr>
    `;
  } else {
    results.forEach((person, index) => {
      const formatTime = (time) => {
        if (!time) return "";

        // FMC logic
        if (selectedEvent === "333fm") {
          return time.toString(); // FMC is stored as integer moves
        }

        // MBLD logic
        if (selectedEvent === "333mbf") {
          const timeStr = time.toString().padStart(10, "0");
          const DD = parseInt(timeStr.substring(1, 3));
          const TTTTT = parseInt(timeStr.substring(3, 8));
          const MM = parseInt(timeStr.substring(8, 10));

          const difference = 99 - DD;
          const missed = MM;
          const solved = difference + missed;
          const attempted = solved + missed;

          if (TTTTT === 99999) {
            return `${solved}/${attempted} Unknown`;
          }

          const hours = Math.floor(TTTTT / 3600);
          const minutes = Math.floor((TTTTT % 3600) / 60);
          const seconds = TTTTT % 60;

          if (hours > 0) {
            return `${solved}/${attempted} ${hours}:${minutes
              .toString()
              .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
          } else {
            return `${solved}/${attempted} ${minutes}:${seconds
              .toString()
              .padStart(2, "0")}`;
          }
        }

        // other events (convert centiseconds to time format)
        const totalSeconds = time / 100;

        if (totalSeconds >= 3600) {
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = (totalSeconds % 60).toFixed(2);
          return `${hours}:${minutes
            .toString()
            .padStart(2, "0")}:${seconds.padStart(5, "0")}`;
        } else if (totalSeconds >= 60) {
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = (totalSeconds % 60).toFixed(2);
          return `${minutes}:${seconds.padStart(5, "0")}`;
        } else {
          return `${totalSeconds.toFixed(2)}`;
        }
      };

      // formatting for FMC mean (4-digit integer to 2 decimal places)
      const formatFMCAverage = (average) => {
        if (!average) return "";
        return (average / 100).toFixed(2);
      };

      const singleTime = formatTime(person.single);
      const averageTime =
        selectedEvent === "333fm"
          ? formatFMCAverage(person.average)
          : formatTime(person.average);

      // medal colors for top 3
      let rankStyle = "";
      if (index === 0) rankStyle = "text-yellow-600 font-bold";
      else if (index === 1) rankStyle = "text-gray-500 font-bold";
      else if (index === 2) rankStyle = "text-amber-600 font-bold";

      htmlContent += `
        <tr class="hover:bg-blue-50 transition-colors duration-150 ${
          index % 2 === 0 ? "bg-white" : "bg-gray-50"
        }">
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="text-lg font-bold ${rankStyle}">${index + 1}</span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="font-semibold text-gray-900">${person.name}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-full">${
              person.wcaId
            }</span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="font-mono text-gray-900 ${
              singleTime ? "bg-green-50 px-2 py-1 rounded" : ""
            }">${singleTime || "-"}</span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="font-mono text-gray-900 ${
              averageTime ? "bg-blue-50 px-2 py-1 rounded" : ""
            }">${averageTime || "-"}</span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <button 
              onclick="removePerson('${person.wcaId}')" 
              class="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded text-sm font-medium transition-colors duration-150"
              title="Remove ${person.name}"
            >
              Remove
            </button>
          </td>
        </tr>
      `;
    });
  }

  htmlContent += `
        </tbody>
      </table>
    </div>
  `;

  rankDisplay.innerHTML = htmlContent;
  console.log(results);
}

function clearPersons() {
  persons = [];
  localStorage.removeItem("wcaPersons");
  document.getElementById("rankDisplay").innerHTML = "";
  showNotification("Cleared all competitors!", "info");
}

// notification
function showNotification(message, type = "info") {
  const colors = {
    success: "bg-green-100 text-green-800 border-green-200",
    error: "bg-red-100 text-red-800 border-red-200",
    info: "bg-blue-100 text-blue-800 border-blue-200",
  };

  const notification = document.createElement("div");
  notification.className = `fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg border z-50 transform transition-all duration-300 ${colors[type]}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  // slide in animation
  setTimeout(() => {
    notification.style.transform = "translateX(0)";
  }, 100);

  // remove after 3 seconds
  setTimeout(() => {
    notification.style.transform = "translateX(100%)";
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// load stored data when the page loads
window.addEventListener("load", loadStoredPersons);

function extractAndAddWCAIds() {
  const rawText = document.getElementById("bulkTextInput").value;
  const regex = /\b\d{4}[A-Z]{4}\d{2}\b/g;
  const matches = rawText.match(regex) || [];

  let added = 0;
  let skipped = 0;

  matches.forEach((id) => {
    if (!persons.includes(id)) {
      persons.push(id);
      added++;
    } else {
      skipped++;
    }
  });

  savePersons();
  showNotification(
    `Extracted ${added} new WCA ID${
      added !== 1 ? "s" : ""
    }. ${skipped} duplicate${skipped !== 1 ? "s" : ""} skipped.`,
    "success"
  );
  document.getElementById("bulkTextInput").value = "";
}
