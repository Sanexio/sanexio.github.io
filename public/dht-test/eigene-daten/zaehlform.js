/** German count labels, shared by visible text and accessibility names. */
export function zaehlform(anzahl,einzahl,mehrzahl){
 return `${anzahl} ${anzahl===1?einzahl:mehrzahl}`;
}
