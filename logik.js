/**
 * Created by Moritz Beck (Birkenstab.de) on 18.04.17.
 */

/**
 * Datei einlesen
 * @param file
 * @returns {Array}
 */
function parseFile(file) {
    const lines = file.split(/\r?\n/).filter(line => line.substr(0, 1) !== "#"); // Zeilen splitten und die mit # vorne aussortieren

    const firstLine = lines[0].split(" "); // Erste Zeile mit Anzahl Kreuzungen und Straßenabschnitte einlesen
    const intersectionCount = parseInt(firstLine[0]);
    const streetCount = parseInt(firstLine[1]);
    if (isNaN(intersectionCount) || isNaN(streetCount))
        throw new Error("Erwarte zwei Zahlen in erster Zeile");

    const intersections = [];
    for (let i = 1; i < 1 + intersectionCount; i++) { // In der zweiten Zeile beginnen
        const line = lines[i].split(" ");
        const name = line[0];
        const x = parseInt(line[1]);
        const y = parseInt(line[2]);
        if (isNaN(x) || isNaN(y))
            throw new Error("Erwarte zwei Zahlen hinter Kreuzungsnamen (Zeile " + (i + 1) + ")");
        intersections.push(new Intersection(intersections.length, name, x, y)); // Neues Intersection-Objekt anlegen
    }

    const middleLine = lines[intersectionCount + 1]; // Zeile die nochmals die Anzahl Straßenabschnitte enthält
    const streetCount2 = parseInt(middleLine);
    if (streetCount2 !== streetCount) {
        throw new Error("Anzahl Straßenabschnitte am Anfang der Datei und in der Mitte müssen übereinstimmen");
    }

    for (let i = intersectionCount + 2; i < 1 + intersectionCount + 1 + streetCount; i++) {
        const line = lines[i].split(" ");
        const intersection1 = getIntersection(line[0]);
        const intersection2 = getIntersection(line[1]);
        intersection1.connections.push(new Connection(intersection1, intersection2)); // Zu beiden Kreuzungen ein Verbindungs-Objekt hinzufügen
        intersection2.connections.push(new Connection(intersection2, intersection1));
    }
    return intersections;

    function getIntersection(name) {
        for (let i = 0; i < intersections.length; i++) {
            if (intersections[i].name === name)
                return intersections[i];
        }
        return null;
    }
}

/**
 * Findet den Pfad von einer Kreuzung zur einer anderen
 * @param from
 * @param to
 * @param routeType 0: Möglichst wenig Straßenabschnitte; 1: Möglichst kurze Strecke; 2: Möglichst wenig Abbiegen
 * @param true wenn Linksabbiegen nicht erlaubt ist
 * @returns {[Connection]} Route
 */
function findPath(from, to, routeType = 0, noLeftTurns = true) {
    const getLowest = [getLowestCount, getLowestLength, getLowestTurns][routeType]; // Je nach Parameter Funktion auswählen
    const visitedConnections = [];
    const visitedSections = [];
    const currentSections = [new RouteSection(routeType, from)]; // Startkreuzung

    while (currentSections.length > 0) { // So lange es noch aktive Sections gibt
        const section = getLowest(); // Section mit der kürzesten Strecke bzw. wenigstens Straßenabschnitte
        const intersection = section.connection.toIntersection; // Kreuzung an der man gerade ist beim Suchen

        if (intersection === to) { // Wenn die richtige Kreuzung gefunden wurde
            return section.getRoute();
        }

        const ways = noLeftTurns ? section.connection.getWays() : section.connection.toIntersection.connections;
        for (let i = 0; i < ways.length; i++) { // In jeder Richtung der Kreuzung weiter suchen
            const newConnection = ways[i]; // Neue Verbindungsstraße
            const newSection = new RouteSection(routeType, newConnection, section);
            if (isNotYetVisited(newSection)) {
                currentSections.push(newSection); // Section für nächste Runde sichern
            }
        }
    }

    return null; // Keine Route gefunden


    /**
     * Gibt zurück ob diese Verbindung noch nicht besucht wurde und fügt sie zur Liste der besuchten hinzu
     * @param connection
     * @returns {boolean}
     */
    function isNotYetVisited(section) {
        const connection = section.connection;
        if (visitedConnections[connection.toIntersection.id] === undefined) { // Wenn noch nie was mit der Kreuzung zu tun gehabt, dann war man da auf jeden Fall noch nicht
            visitedConnections[connection.toIntersection.id] = [connection];
            visitedSections[connection.toIntersection.id] = [section];
            return true;
        }
        if (!visitedConnections[connection.toIntersection.id].includes(connection)) { // Schauen ob man auch wirklich von der gefragten Richtung gekommen ist
            visitedConnections[connection.toIntersection.id].push(connection);
            visitedSections[connection.toIntersection.id].push(section);
            return true;
        }

        const value = section.getValue();
        const sections = visitedSections[connection.toIntersection.id];
        for (let i = 0; i < sections.length; i++) { // Überprüfen ob die Pfade die zu dieser Connection führen langsamer sind
            if (sections[i].getValue() <= value) { // Wenn es einen Weg gibt, der besser oder gleich gut ist, dann aktuellen verwerfen
                return false;
            }
        }

        return true;
    }

    /**
     * Gibt die Section mit der kleinsten Anzahl Straßenabschnitte zurück
     * @returns {RouteSection}
     */
    function getLowestCount() {
        let minSection = currentSections[0];
        let minIndex = 0;
        for (let i = 0; i < currentSections.length; i++) {
            if (minSection.count > currentSections[i].count) { // Schauen ob bei einer anderen Section kleiner ist
                minSection = currentSections[i];
                minIndex = i;
            }
        }
        currentSections.splice(minIndex, 1); // Section aus Array löschen
        return minSection;
    }

    /**
     * Gibt die Section mit der kleinsten Strecke zurück
     * @returns {RouteSection}
     */
    function getLowestLength() {
        let minSection = currentSections[0];
        let minIndex = 0;
        for (let i = 0; i < currentSections.length; i++) {
            if (minSection.totalLength > currentSections[i].totalLength) { // Schauen ob bei einer anderen Section kleiner ist
                minSection = currentSections[i];
                minIndex = i;
            }
        }
        currentSections.splice(minIndex, 1); // Section aus Array löschen
        return minSection;
    }

    /**
     * Gibt die Sections mit dem wenigsten Abbiegen zurück
     * @returns {RouteSection}
     */
    function getLowestTurns() {
        let minSection = currentSections[0];
        let minIndex = 0;
        for (let i = 0; i < currentSections.length; i++) {
            if (minSection.turns > currentSections[i].turns) { // Schauen ob bei einer anderen Section kleiner ist
                minSection = currentSections[i];
                minIndex = i;
            }
        }
        currentSections.splice(minIndex, 1); // Section aus Array löschen
        return minSection;
    }
}

/**
 * Prüft ob jede Kreuzung von jeder anderen Kreuzung erreicht werden kann
 * @returns {*}
 */
function isEveryIntersectionAccessible() {
    const result = []; // Hier wird gespeichert welche Kreuzungen von welchen Kreuzungen erreicht werden konnten

    for (let i = 0; i < intersections.length; i++) {
        const fromIntersection = intersections[i]; // Startkreuzung
        for (let j = intersections.length - 1; j >= 0; j--) {

            if (i === j) // Wenn Start- und Endkreuzung die selben sind
                continue;
            const toIntersection = intersections[j]; // Endkreuzung
            if (result[i] !== undefined && result[i][j] === true) // Wenn bereits bekannt ist, dass sie erreichbar sind
                continue;

            const route = findPath(fromIntersection, toIntersection); // Route berechnen
            if (route === null) { // Wenn es keine Verbindung gibt
                return {
                    from: fromIntersection,
                    to: toIntersection
                };
            }
            for (let k = 0; k < route.length - 1; k++) { // Verbindungen, die durch die Route auch auf jeden fall bestehen, eintragen
                const from = route[k].connection.toIntersection;
                if (result[from.id] === undefined)
                    result[from.id] = [];
                for (let l = k + 1; l < route.length; l++) {
                    const to = route[l].connection.toIntersection;
                    result[from.id][to.id] = true;
                }
            }
        }
    }
    return true; // Alles ist erreichbar
}

/**
 * Gibt das Kreuzungspaar zurück, dessen Weg durch das Verbot am größten wird im Vergleich zu davor
 * @param routeType
 * @returns {*}
 */
function getWorseChange(routeType) {
    let maxPair = null;

    for (let i = 0; i < intersections.length; i++) {
        const fromIntersection = intersections[i]; // Startkreuzung
        for (let j = intersections.length - 1; j >= 0; j--) {

            if (i === j) // Wenn Start- und Endkreuzung die selben sind
                continue;
            const toIntersection = intersections[j]; // Endkreuzung

            const route1 = findPath(fromIntersection, toIntersection, routeType, false); // Route berechnen mit Linksabbiegen
            const route2 = findPath(fromIntersection, toIntersection, routeType); // Route berechnen ohne Linksabbiegen
            if (route2 === null) { // Wenn es keine Verbindung gibt
                continue;
            }
            const factor = [(route2.length - 1) / (route1.length - 1), route2[route2.length - 1].totalLength / route1[route1.length - 1].totalLength, route2[route2.length - 1].turns / route1[route1.length - 1].turns][routeType];
            if (maxPair === null || maxPair.factor < factor) { // Wenn der Faktor bei der aktuellen Verbindung größer ist
                maxPair = {
                    factor,
                    from: fromIntersection,
                    to: toIntersection
                };
            }
        }
    }
    return maxPair;
}