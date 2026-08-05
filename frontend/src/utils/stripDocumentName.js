/** Strip UUID v4 suffix and .json from document filenames for display. */
const uuidPattern =
  /-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/;
const jsonPattern = /\.json$/;

export function stripUuidAndJsonFromString(input = "") {
  return input
    ?.replace(uuidPattern, "")
    ?.replace(jsonPattern, "")
    ?.replace("-", " ");
}
