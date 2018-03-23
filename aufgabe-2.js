/**
 * Created by Moritz Beck (Birkenstab.de) on 15.04.17.
 */

const svgNS = "http://www.w3.org/2000/svg";

let intersections;

/**
 * Wird beim Laden der Seite aufgerufen
 */
function init() {
    const strassennetze = [
        "rechthausen1.txt",
        "meins1.txt",
        "meins2.txt",
        "meins3.txt",
        "meins4.txt"
    ];
    const $netzSelector = document.querySelector("#netzSelector");
    for (let i = 0; i < strassennetze.length; i++) { // Vorhandene Beispiele zum Dropdown-Menu hinzufügen
        const option = document.createElement("option");
        option.value = "strassennetze/" + strassennetze[i];
        option.appendChild(document.createTextNode(strassennetze[i]));
        $netzSelector.appendChild(option);
    }

    document.querySelector("#ladeButton").addEventListener("click", () => { // Laden-Knopf
        loadFile($netzSelector.value);
    });

    document.querySelector("#routeBerechnenButton").addEventListener("click", computeRoute); // Routen-Brechnungs-Knopf
    document.querySelector("#dateiinhaltEingebenButton").addEventListener("click", openCustomFileDialog); // Knopf um eigenen Dateiinhalt einzulesen
    document.querySelector("#allesErreichbarButton").addEventListener("click", checkIfAllIsAccessible); // Knopf um zu prüfen, ob alle Kreuzungen erreichbar sind
    document.querySelector("#amLaengstenButton").addEventListener("click", checkForWorseChange); // Knopf um zu prüfen, zwischen welchen beiden Kreuzungen der Weg am größten wird im Vergleich zu davor
}

/**
 * Lädt eine Datei mit dem gegebenen Dateinamen und parst sie
 * @param filename
 */
function loadFile(filename) {
    prepareFileLoading();
    const xhr = new XMLHttpRequest();
    xhr.addEventListener("load", () => finishFileLoading(xhr.responseText));
    xhr.open("GET", filename);
    xhr.send();
}

/**
 * Wird ausgeführt bevor eine neue Datei eingelesen wird
 */
function prepareFileLoading() {
    disableControls(); // Steuerelemente deaktivieren
    showText("Lade…");
    document.querySelector("#infoText2").innerHTML = "Route berechnen";
    document.querySelector("#infoText3").innerHTML = "Sind alle Kreuzungen von allen Kreuzungen ohne Linksabbiegen erreichbar?";
    document.querySelector("#infoText4").innerHTML = "Zwischen welcher Start- und Endkreuzung wird die Strecke nach dem verboten am größten im Vergleich zu davor?";
    document.querySelector("#routenTextArea").value = "";

    const $intersections = document.querySelector("#intersections");
    while ($intersections.firstChild) // Aktuelles Straßennetz entfernen
        $intersections.firstChild.remove();
}

/**
 * Wird nach dem Lesen einer neuen Datei ausgeführt
 * @param content
 */
function finishFileLoading(content) {
    try {
        intersections = parseFile(content); // Datei parsen
    } catch (e) {
        alert("Fehler beim Parsen der Datei: " + e);
        showText("Fehler beim Parsen");
        enableControls(); // Steuerelemente wieder aktivieren
        return;
    }
    showText("Geladen");
    updateIntersectionList(); // Kreuzungen zu den Dropdown Menus hinzufügen
    enableControls(); // Steuerelemente wieder aktivieren
    if (intersections.length > 1000) {
        if (!confirm("Dieses Straßennetz enthält mehr als 1000 Kreuzungen. Das Darstellen könnte den Browser verlangsamen. Soll es wirklich angezeigt werden? Alle anderen Funktionen sind trotzdem möglich"))
            return;
    }
    showIntersections(); // Straßennetz darstellen
}

/**
 * Fügt die Kreuzungen zu den Dropdown-Menus hinzu
 */
function updateIntersectionList() {
    document.querySelectorAll("#startKreuzungSelector, #endKreuzungSelector").forEach(element => {
        while (element.firstChild) // Alte Kreuzungen aus Liste löschen
            element.firstChild.remove();
        for (let i = 0; i < intersections.length; i++) { // Neue Kreuzungen hinzufügen
            const option = document.createElement("option");
            option.value = intersections[i].name;
            option.appendChild(document.createTextNode(intersections[i].name));
            element.appendChild(option);
        }
    });
}

/**
 * Zeigt das Straßennetz mit Kreuzungen und Verbindungsstraßen an
 */
function showIntersections() {
    const $intersections = document.querySelector("#intersections");

    let maxX = 0; // Um später die viewBox zu setzen
    let maxY = 0;

    // Damit die Linien nicht den Rest übermalen, werden sie als erstes angelegt
    for (let i = 0; i < intersections.length; i++) {
        const intersection = intersections[i];
        for (let i = 0; i < intersection.connections.length; i++) {
            const connection = intersection.connections[i];
            const intersection2 = connection.toIntersection; // Kreuzung zu der die Straße führt
            const line = document.createElementNS(svgNS, "line"); // Neue Linie anlegen
            line.setAttribute("x1", intersection.x); // Koordinaten setzen
            line.setAttribute("y1", intersection.y);
            line.setAttribute("x2", intersection2.x);
            line.setAttribute("y2", intersection2.y);
            $intersections.appendChild(line);
        }
    }
    for (let i = 0; i < intersections.length; i++) { // Kreuzungen anlegen
        const intersection = intersections[i];
        if (maxX < intersection.x)
            maxX = intersection.x;
        if (maxY < intersection.y)
            maxY = intersection.y;
        const circle = document.createElementNS(svgNS, "circle"); // Kreis anlegen
        circle.setAttribute("cx", intersection.x); // Koordinaten
        circle.setAttribute("cy", intersection.y);
        circle.setAttribute("r", 0.3); // Radius
        $intersections.appendChild(circle);

        const text = document.createElementNS(svgNS, "text"); // Text anlegen mit
        text.setAttribute("x", intersection.x);
        text.setAttribute("y", intersection.y);
        text.setAttribute("text-anchor", "middle"); // Damit der Text zentriert angezeigt wird
        text.appendChild(document.createTextNode(intersection.name)); // Name der Kreuzung setzen
        $intersections.appendChild(text);
    }
    $intersections.setAttribute("viewBox", "-1 -1 " + (maxX + 2) + " " + (maxY + 2)); // viewBox setzen, der die Darstellungsgröße mitbestimmt
}

/**
 * Berechnet die Route und zeigt das Ergebnis dann an
 */
function computeRoute() {
    const from = getIntersection(document.querySelector("#startKreuzungSelector").value);
    const to = getIntersection(document.querySelector("#endKreuzungSelector").value);
    const routeType = parseInt(document.querySelector("#routenTypSelector").value); // Routenart
    const type = ["möglichst wenigen Straßenabschnitten", "möglichst kurzer Distanz", "möglichst wenig Abbiegen"][routeType];
    document.querySelector("#infoText2").innerHTML = "Route mit " + type + " wird berechnet…";

    console.time("findPath");
    const route = findPath(from, to, routeType);
    console.timeEnd("findPath");

    if (route === null) {
        document.querySelector("#infoText2").innerHTML = "Es gibt keine Route von " + from.name + " nach " + to.name;
        document.querySelector("#routenTextArea").value = "Keine Route";
        return;
    }

    showRoute(route);
    document.querySelector("#infoText2").innerHTML = "Route mit " + type + " wurde berechnet. Routenbeschreibung ist im Kasten unten zu sehen. Sofern das Straßennetz dargestellt wurde, ist auch dort die Route eingezeichnet.";

    const routenText = route.map((section, index, array) => { // Routentext erstellen
        const connection = section.connection;
        if (index === 0) { // Wenn erster Schritt
            return `Start: ${connection.toIntersection.name}`;
        }
        if (index === 1) { // Wenn zweiter Schritt
            const angle = ((connection.angle + Math.PI/2 + 2*Math.PI) % (2*Math.PI)) / Math.PI * 180; // Bogenmaß in Gradmaß umwandeln und auf Norden beziehen (Nord = 0°)
            return `In Richtung ${Math.round(angle)}° (${getCardinalDirection(angle)}) fahren`;
        }
        const angle = connection.getAngleWith(array[index - 1].connection) / Math.PI * 180; // Bogenmaß in Gradmaß
        if (angle === 0) {
            return `Geradeaus in Richtung ${connection.toIntersection.name} fahren`;
        }
        if (angle === -180) {
            return `Wenden und wieder in Richtung ${connection.toIntersection.name} fahren`;
        }
        return `Im ${Math.round(Math.abs(angle))}° Winkel nach ${angle < 0 ? "rechts" : "links"} in Richtung ${connection.toIntersection.name} abbiegen`;
    });

    routenText.push(`Ankunft: ${route[route.length - 1].connection.toIntersection.name}`);
    const infoText = `Route mit ${type}\nLänge: ${route[route.length - 1].totalLength.toFixed(2)}; Straßenabschnitte: ${route.length - 1} Anzahl Abbiegen: ${route[route.length - 1].turns}`;
    document.querySelector("#routenTextArea").value = infoText + "\n" + routenText.join("\n");
}

/**
 * Prüft ob alle Kreuzungen von allen Krezungen aus erreichbar sind ohne Linksabbiegen
 */
function checkIfAllIsAccessible() {
    if (intersections.length > 200) {
        if (!confirm("Dieses Straßennetz enthält mehr als 200 Kreuzungen. Die Überprüfung könnte etwas dauern. Fortfahren?"))
            return;
    }
    document.querySelector("#infoText3").innerHTML = "Prüfe ob alle Kreuzungen von überall erreichbar sind…";

    console.time("accessible");
    const result = isEveryIntersectionAccessible();
    console.timeEnd("accessible");

    if (result === true) {
        document.querySelector("#infoText3").innerHTML = "Jede Kreuzung ist von jeder anderen Kreuzung ohne Linksabbiegen erreichbar";
    } else {
        document.querySelector("#infoText3").innerHTML = `Die Kreuzung ${result.to.name} ist nicht von der Kreuzung ${result.from.name} erreichbar. Überprüfung abgebrochen`;
    }

}

/**
 * Findet das Kreuzungspaar, dessen Weg durch das Verbot am größten wird im Vergleich zu davor
 */
function checkForWorseChange() {
    if (intersections.length > 100) {
        if (!confirm("Dieses Straßennetz enthält mehr als 100 Kreuzungen. Die Überprüfung könnte etwas dauern. Fortfahren?"))
            return;
    }
    document.querySelector("#infoText4").innerHTML = "Finde Kreuzungspaar, denen das das Verbot am meisten schadet…";

    const routeType = document.querySelector("#routeTypeAmLaengstenSelector").value;
    const type = ["möglichst wenigen Straßenabschnitten", "möglichst kurzer Distanz", "möglichst wenig Abbiegen"][routeType];

    console.time("worseChange");
    const result = getWorseChange(routeType);
    console.timeEnd("worseChange");

    document.querySelector("#infoText4").innerHTML = `Die Verbindung von der Kreuzung ${result.from.name} zur Kreuzung ${result.to.name} wird durch das Verbot ${result.factor.toFixed(2)} Mal so „lang“ bei Anwendung der Routenart ${type}`;

}

/**
 * Öffnet den Dialog um einen eigenen Dateiinhalt einzufügen
 */
function openCustomFileDialog() {
    const overlay = document.createElement("div"); // Für dich Abdunklung des Inhalts
    overlay.classList.add("overlay");

    const popup = document.createElement("div"); // Box
    popup.classList.add("popup");
    const p = document.createElement("p");
    p.appendChild(document.createTextNode("Füge hier den Inhalt der Datei ein, die eingelesen werden soll"));
    popup.appendChild(p);
    const textarea = document.createElement("textarea"); // Textfeld
    popup.appendChild(textarea);
    popup.appendChild(document.createElement("br"));
    const button = document.createElement("button");
    button.appendChild(document.createTextNode("Laden"));
    button.addEventListener("click", () => { // Inhalt laden
        overlay.remove();
        prepareFileLoading();
        finishFileLoading(textarea.value);
    });
    popup.appendChild(button);

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}

/**
 * Markiert die Route im Straßennetz
 * @param route
 */
function showRoute(route) {
    if (!document.querySelector("#intersections").firstChild) // Wenn das Straßennetzt gar nicht angezeigt worden ist, soll die Route dort auch nicht eingezeichnet werden
        return;
    document.querySelectorAll("line").forEach(element => element.style.stroke = null); // Erstmal alle Straßen wieder schwarz machen
    for (let i = 1; i < route.length; i++) {
        setLineColor(route[i].connection.fromIntersection.x, route[i].connection.fromIntersection.y, route[i].connection.toIntersection.x, route[i].connection.toIntersection.y, "#0000ff");
    }
}

/**
 * Zeigt einen Text an
 * @param text
 */
function showText(text) {
    document.querySelector("#infoText").innerHTML = text;
}

/**
 * Deaktiviert die Steuerelemente
 */
function disableControls() {
    document.querySelectorAll("button, input, select").forEach(element => element.disabled = true);
}

/**
 * Aktiviert die Steuerelemente
 */
function enableControls() {
    document.querySelectorAll("button, input, select").forEach(element => element.disabled = false);
}

/**
 * Findet die Straßen
 * @param x1
 * @param y1
 * @param x2
 * @param y2
 * @returns {Element}
 */
function findLine(x1, y1, x2, y2) {
    return document.querySelector(`line[x1="${x1}"][y1="${y1}"][x2="${x2}"][y2="${y2}"]`);
}

/**
 * Setzt die Farbe einer Straße
 * @param x1
 * @param y1
 * @param x2
 * @param y2
 * @param color
 */
function setLineColor(x1, y1, x2, y2, color) {
    findLine(x1, y1, x2, y2).style.stroke = color;
    findLine(x2, y2, x1, y1).style.stroke = color;
}

/**
 * Findet die Kreuzung mit dem gegebenen Namen
 * @param name
 * @returns {Intersection}
 */
function getIntersection(name) {
    for (let i = 0; i < intersections.length; i++) {
        if (intersections[i].name === name)
            return intersections[i];
    }
    return null;
}

/**
 * Gibt die Himmelsrichtung zurück
 * @param angle
 * @returns {String}
 */
function getCardinalDirection(angle) {
    const directions = 8;

    const degree = 360 / directions;
    angle = angle + degree/2;

    if (angle >= 0  && angle < degree)
        return "Nord";
    if (angle >= degree && angle < 2 * degree)
        return "Nord-Ost";
    if (angle >= 2 * degree && angle < 3 * degree)
        return "Ost";
    if (angle >= 3 * degree && angle < 4 * degree)
        return "Süd-Ost";
    if (angle >= 4 * degree && angle < 5 * degree)
        return "Süd";
    if (angle >= 5 * degree && angle < 6 * degree)
        return "Süd-West";
    if (angle >= 6 * degree && angle < 7 * degree)
        return "West";
    if (angle >= 7 * degree && angle < 8 * degree)
        return "Nord-West";
    return "Nord";
}

/**
 * Repräsentiert eine Krezung
 */
class Intersection {
    constructor(id, name, x, y) {
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.connections = [];
    }
}

/**
 * Repräsentiert die Verbindung einer Kreuzung mit einer anderen
 * Enthält den Winkel den die Straße hat, die die Kreuzung verlässt
 */
class Connection {
    constructor(fromIntersection, toIntersection) {
        this.fromIntersection = fromIntersection;
        this.toIntersection = toIntersection;
        if (fromIntersection !== null) {
            this.angle = Math.atan2(toIntersection.y - fromIntersection.y, toIntersection.x - fromIntersection.x); // Winkel im Bogenmaß berechnen in deren Richtung die Straße zeigt (nach rechts ist 0)
            this.length = Math.sqrt(Math.pow(fromIntersection.x - toIntersection.x, 2) + Math.pow(fromIntersection.y - toIntersection.y, 2));
        }
    }

    /**
     * Winkel zwischen zu einer anderen Verbindungsstraße
     * @param connection
     * @returns {number}
     */
    getAngleWith(connection) {
        return ((connection.angle - this.angle + 3*Math.PI) % (2*Math.PI)) - Math.PI;
    }

    /**
     * Gibt zurück, auf welche Straßen man fahren darf
     * @returns {[Connection]}
     */
    getWays() {
        if (this.ways !== undefined) // Caching
            return this.ways;
        const ways = this.toIntersection.connections; // Alle Straßen, die man weiterfahren könnte
        if (this.angle === undefined || // Wenn kein Winkel gesetzt ist, weil an dieser Kreuzung angefangen wurde zu fahren, dann darf man in alle Straßen einfahren
            ways.length === 1) { // Oder Wenn es eine Sackgasse ist, soll man Wenden dürfen
            return this.ways = ways;
        }
        return this.ways = ways.filter((connection, index, array) => { // Linksabbiegen aussortieren
            if (connection.toIntersection === this.fromIntersection) // Wenn es der Wege wieder zurück ist (wenden), dann aussortieren, weil das auch als Linksabbiegen gilt
                return false;
            const angle = this.getAngleWith(connection); // Winkel zwischen den Straßen berechnen
            if (angle >= 0) // Wenn der Winkel größer als oder gleich 0 ist, dann ist es auf jeden Fall kein Linksabbiegen
                return true;
            for (let i = 0; i < array.length; i++) { // Da es nicht als Linksabbiegen gilt, wenn sich rechts der Straße keine weitere Straße befindet, muss dies hier überprüft werden
                if (array[i].toIntersection !== this.fromIntersection && this.getAngleWith(array[i]) > angle)
                    return false
            }
            return true;
        });
    }
}

/**
 * Teil einer Route. Enthält die Verbindungsstraße zwischen zwei Kreuzungen und die letzte Section
 */
class RouteSection {
    constructor(routeType, connection, lastSection) {
        if (connection instanceof Intersection) {
            connection = new Connection(null, connection);
            lastSection = null;
        }
        this.routeType = routeType;
        this.connection = connection;
        this.lastSection = lastSection;
        if (lastSection === null) {
            this.totalLength = 0;
            this.count = 0;
            this.turns = 0;
        } else {
            this.totalLength = lastSection.totalLength + connection.length;
            this.count = lastSection.count + 1;
            this.turns = lastSection.turns;
            if (lastSection.connection.angle !== undefined && lastSection.connection.angle !== connection.angle)
                this.turns++;
        }
    }

    /**
     * Liefert ein Array von Connections die die Route repräsentieren
     * @returns {[Connection]}
     */
    getRoute() {
        let section = this;
        const route = [];
        while (section !== null) {
            route.unshift(section);
            section = section.lastSection;
        }
        return route;
    }

    getValue() {
        return [this.count, this.totalLength, this.turns][this.routeType];
    }

    toString() {
        return "[" + this.getRoute().map(connection => connection.toIntersection.name).join(" -> ") + "]";
    }
}

function generateIntersections(count, width, connections) {
    const intersections = [];
    const part1 = [];
    for (let i = 0; i < count; i++) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * width);
        const intersection = new Intersection(i, i, x, y);
        intersections.push(intersection);
        part1.push(`${i} ${x} ${y}`);
    }

    const conns = [];
    for (let i = 0; i < intersections.length; i++) {
        const intersection = intersections[i];
        const nearest = intersections.slice().sort((a, b) => getDistance(intersection, a) - getDistance(intersection, b)).slice(1, connections + 1);
        for (let i = 0; i < nearest.length; i++) {
            if (Math.random() > 0.1) {
                conns.push({
                    from: intersection.name,
                    to: nearest[i].name
                });
            }
        }
    }

    const part2 = [];

    outer:
        for (let i = 0; i < conns.length; i++) {
            const conn = conns[i];
            for (let j = i + 1; j < conns.length; j++) {
                const conn2 = conns[j];
                if (conn2.from === conn.to && conn2.to === conn.from) {
                    continue outer;
                }
            }
            part2.push(`${conn.from} ${conn.to}`);
        }

    const result = `${part1.length} ${part2.length}\n` + part1.join("\n") + `\n${part2.length}\n` + part2.join("\n");


    prepareFileLoading();
    finishFileLoading(result);

    document.querySelector("#routenTextArea").value = result;

    function getDistance(i1, i2) {
        return Math.pow(i1.x - i2.x, 2) + Math.pow(i1.y - i2.y, 2);
    }
}