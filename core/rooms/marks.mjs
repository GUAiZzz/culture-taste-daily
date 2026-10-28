// Original production vector marks: unequal sweeps, open joins, local retracing.
const wrap=(paths,cls='')=>`<svg class="pen-mark ${cls}" viewBox="0 0 80 70" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
export const marks={
 field:wrap('<path d="M13 13C28 9 44 10 65 7L67 55 19 60C13 44 17 25 13 13" stroke-width="3"/><path d="M22 12L25 54M29 24C39 25 43 20 56 22M32 35L53 33M31 45L44 45" stroke-width="2.3"/><path d="M12 10L15 27M20 59L51 57" stroke-width="1.2"/>'),
 coral:wrap('<path d="M12 13L56 8 65 43 21 50 12 16" stroke-width="3.2"/><path d="M19 55L64 50 71 20M26 61L72 55 73 32" stroke-width="2.2"/><path d="M26 25L49 21M30 34L47 33" stroke-width="3.5"/><path d="M9 14L14 31" stroke-width="1.1"/>'),
 analog:wrap('<path d="M11 23C23 18 51 19 68 17L72 56C54 58 24 64 11 59L8 29" stroke-width="3.1"/><path d="M18 27C31 23 49 23 57 26L58 48C43 53 30 52 19 49L18 30" stroke-width="2.2"/><path d="M27 5L37 19 50 3M26 61L22 66M59 60L62 64" stroke-width="2.5"/><path d="M65 32L65 36M65 43L66 47" stroke-width="4"/>'),
 arrow:wrap('<path d="M9 57C26 44 40 40 65 14M46 16L68 11C68 21 64 28 66 35" stroke-width="3"/><path d="M66 12L52 17" stroke-width="1.3"/>','pen-arrow'),
 circle:wrap('<path d="M66 17C48 3 9 7 8 31 7 59 49 66 67 49 77 40 68 13 50 8M14 48C29 59 53 58 66 48" stroke-width="2.5"/>','pen-circle'),
 underline:'<svg class="pen-underline" viewBox="0 0 400 24" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4 12C64 20 112 3 160 11S286 15 395 7M56 18C154 12 250 22 354 13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>'
};
