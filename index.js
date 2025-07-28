let persons = [];

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
    }

    document.getElementById("wcaId").value = "";
  } catch (error) {
    console.log(error);
    document.getElementById("wcaId").value = "";
  }
}

async function displayRanks() {
  const rankDisplay = document.getElementById("rankDisplay");
  const selectedEvent = document.getElementById("event").value;

  try {
    let results = [];

    for (const wcaId of persons) {
      const response = await fetch(
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

        results.push({
          name: data.name,
          wcaId: wcaId,
          single: single,
          average: average,
        });
      }
    }

    results.sort((a, b) => {
      const timeA = a.average || a.single || Infinity;
      const timeB = b.average || b.single || Infinity;
      return timeA - timeB;
    });

    let htmlContent = `
      <h3>results for ${selectedEvent}</h3>
      <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Rank</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Name</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">WCA ID</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Single</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Average</th>
          </tr>
        </thead>
        <tbody>
    `;

    results.forEach((person, index) => {
      const formatTime = (time) => {
        if (!time) return "";

        // mbld logic
        if (selectedEvent === "333mbf") {
          // format: 0DDTTTTTMM
          const timeStr = time.toString().padStart(10, "0");

          // extract components
          const DD = parseInt(timeStr.substring(1, 3));
          const TTTTT = parseInt(timeStr.substring(3, 8));
          const MM = parseInt(timeStr.substring(8, 10));

          const difference = 99 - DD;
          const missed = MM;
          const solved = difference + missed;
          const attempted = solved + missed;

          // handle unknown time case
          if (TTTTT === 99999) {
            return `${solved}/${attempted} Unknown`;
          }

          // format time with hours if needed
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

        // convert centiseconds to time format
        const totalSeconds = time / 100;

        if (totalSeconds >= 3600) {
          // format as HH:MM:SS.SS for times over 1 hour
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = (totalSeconds % 60).toFixed(2);
          return `${hours}:${minutes
            .toString()
            .padStart(2, "0")}:${seconds.padStart(5, "0")}`;
        } else if (totalSeconds >= 60) {
          // format as MM:SS.SS for times over 1 minute
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = (totalSeconds % 60).toFixed(2);
          return `${minutes}:${seconds.padStart(5, "0")}`;
        } else {
          // format as SS.SS for times under 1 minute
          return `${totalSeconds.toFixed(2)}`;
        }
      };

      const singleTime = formatTime(person.single);
      const averageTime = formatTime(person.average);

      htmlContent += `
        <tr style="background-color: ${index % 2 === 0 ? "#f9f9f9" : "white"};">
          <td style="border: 1px solid #ddd; padding: 12px;">${index + 1}</td>
          <td style="border: 1px solid #ddd; padding: 12px;"><strong>${
            person.name
          }</strong></td>
          <td style="border: 1px solid #ddd; padding: 12px;">${
            person.wcaId
          }</td>
          <td style="border: 1px solid #ddd; padding: 12px;">${singleTime}</td>
          <td style="border: 1px solid #ddd; padding: 12px;">${averageTime}</td>
        </tr>
      `;
    });

    htmlContent += `
        </tbody>
      </table>
    `;

    rankDisplay.innerHTML = htmlContent;
    console.log(results);
  } catch (error) {
    console.log(error);
  }
}

function clearPersons() {
  persons = [];
  document.getElementById("rankDisplay").innerHTML = "";
}
