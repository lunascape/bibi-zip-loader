export function isIE(): boolean {
    return !!document['uniqueID'];
}
