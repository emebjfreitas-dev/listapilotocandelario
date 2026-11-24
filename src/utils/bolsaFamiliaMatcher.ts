import { ClassGroup, Student } from '../types';

export interface MatchedBeneficiaryItem {
  student: Student;
  cls: ClassGroup;
  matchedBy: 'nis' | 'ra' | 'nome_exato' | 'nome_aproximado';
  sourceLine: string;
}

export interface BeneficiaryMatchResult {
  parsedLinesCount: number;
  matchedItems: MatchedBeneficiaryItem[];
  unmatchedLines: string[];
  duplicateLinesCount: number;
}

const STOP_WORDS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E']);

const HEADER_LINE_PATTERNS = [
  /^(nome|estudante|aluno|beneficiario|responsavel|nis|ra|turma|ordem|nº|no\.?)(\s*[;,\t|-]\s*(nome|estudante|aluno|beneficiario|nis|ra|turma|faltas|frequencia).*)*$/i,
  /^lista\s+(de\s+)?benefici/i,
  /^bolsa\s+fam[ií]lia/i,
];

export const normalizeSearchToken = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stripLeadingListMarker = (line: string): string =>
  line
    .replace(/^\s*(?:[•\-–—*]|\(?\d{1,4}\)?[.)\-–:\s]+)\s*/, '')
    .trim();

const extractDigitSequences = (text: string): string[] => {
  const matches = text.match(/\d{6,14}/g);
  return matches ? matches : [];
};

const getSignificantTokens = (normalized: string): string[] =>
  normalized
    .split(' ')
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));

interface IndexedStudent {
  student: Student;
  cls: ClassGroup;
  normalizedName: string;
  significantTokens: string[];
  nisDigits: string;
  raDigits: string;
  raFullDigits: string;
}

export const parseAndMatchBeneficiariesList = (
  rawText: string,
  classes: ClassGroup[]
): BeneficiaryMatchResult => {
  const rawLines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (rawLines.length === 0) {
    return {
      parsedLinesCount: 0,
      matchedItems: [],
      unmatchedLines: [],
      duplicateLinesCount: 0,
    };
  }

  const indexedStudents: IndexedStudent[] = [];
  const byNis = new Map<string, IndexedStudent[]>();
  const byRa = new Map<string, IndexedStudent[]>();
  const byExactName = new Map<string, IndexedStudent[]>();

  classes.forEach((cls) => {
    cls.students.forEach((student) => {
      const normalizedName = normalizeSearchToken(student.name || student.estudante || '');
      const significantTokens = getSignificantTokens(normalizedName);
      const nisDigits = (student.nis || '').replace(/\D/g, '');
      const raDigits = (student.ra || '').replace(/\D/g, '');
      const digRa = (student.digRa || '').replace(/\D/g, '');
      const raFullDigits = raDigits && digRa ? `${raDigits}${digRa}` : raDigits;

      const entry: IndexedStudent = {
        student,
        cls,
        normalizedName,
        significantTokens,
        nisDigits,
        raDigits,
        raFullDigits,
      };
      indexedStudents.push(entry);

      if (nisDigits.length >= 6) {
        const list = byNis.get(nisDigits) || [];
        list.push(entry);
        byNis.set(nisDigits, list);
      }

      if (raDigits.length >= 6) {
        const list = byRa.get(raDigits) || [];
        list.push(entry);
        byRa.set(raDigits, list);
        if (raFullDigits !== raDigits) {
          const fullList = byRa.get(raFullDigits) || [];
          fullList.push(entry);
          byRa.set(raFullDigits, fullList);
        }
      }

      if (normalizedName) {
        const nameList = byExactName.get(normalizedName) || [];
        nameList.push(entry);
        byExactName.set(normalizedName, nameList);
      }
    });
  });

  const matchedIds = new Set<string>();
  const matchedItems: MatchedBeneficiaryItem[] = [];
  const unmatchedLines: string[] = [];
  let parsedLinesCount = 0;
  let duplicateLinesCount = 0;

  for (const originalLine of rawLines) {
    const cleaned = stripLeadingListMarker(originalLine);
    if (!cleaned) continue;
    if (HEADER_LINE_PATTERNS.some((rx) => rx.test(cleaned))) continue;

    parsedLinesCount += 1;

    // Split line into candidate columns (Excel tab, semicolon, pipe, or comma)
    const columns = cleaned
      .split(/[\t;|]/)
      .map((part) => stripLeadingListMarker(part))
      .filter(Boolean);

    const digitSequences = extractDigitSequences(cleaned);

    let matchedEntry: IndexedStudent | null = null;
    let matchedBy: MatchedBeneficiaryItem['matchedBy'] = 'nome_exato';

    // 1. Match by NIS digits
    for (const seq of digitSequences) {
      const nisHits = byNis.get(seq);
      if (nisHits && nisHits.length > 0) {
        matchedEntry = nisHits[0];
        matchedBy = 'nis';
        break;
      }
    }

    // 2. Match by RA digits
    if (!matchedEntry) {
      for (const seq of digitSequences) {
        const raHits = byRa.get(seq);
        if (raHits && raHits.length > 0) {
          matchedEntry = raHits[0];
          matchedBy = 'ra';
          break;
        }
      }
    }

    // 3. Match by exact normalized name (whole line or individual column)
    if (!matchedEntry) {
      const candidates = [cleaned, ...columns]
        .map((c) => normalizeSearchToken(c.replace(/\d+/g, ' ')))
        .filter((c) => c.length >= 4);

      for (const cand of candidates) {
        const exactHits = byExactName.get(cand);
        if (exactHits && exactHits.length > 0) {
          matchedEntry = exactHits[0];
          matchedBy = 'nome_exato';
          break;
        }
      }
    }

    // 4. Match by strong token overlap (handles extra columns like class/DOB or missing particles DE/DA)
    if (!matchedEntry) {
      const lineNormalized = normalizeSearchToken(cleaned.replace(/\d+/g, ' '));
      const lineTokens = new Set(getSignificantTokens(lineNormalized));

      if (lineTokens.size >= 2) {
        let bestCandidate: IndexedStudent | null = null;
        let bestScore = 0;

        for (const candidate of indexedStudents) {
          if (candidate.significantTokens.length < 2) continue;

          let hits = 0;
          for (const tok of candidate.significantTokens) {
            if (lineTokens.has(tok)) hits += 1;
          }

          const allStudentTokensPresent = hits === candidate.significantTokens.length;
          const ratio = hits / candidate.significantTokens.length;
          const reverseRatio = hits / lineTokens.size;

          // Either full student name appears in the pasted row, or >=80% mutual token overlap (at least 2 tokens + first & last name)
          const firstTokenMatch = lineTokens.has(candidate.significantTokens[0]);
          const lastTokenMatch = lineTokens.has(
            candidate.significantTokens[candidate.significantTokens.length - 1]
          );

          if (
            allStudentTokensPresent ||
            (hits >= 2 && firstTokenMatch && lastTokenMatch && ratio >= 0.75 && reverseRatio >= 0.6)
          ) {
            const score = hits * 10 + (allStudentTokensPresent ? 5 : 0) + ratio;
            if (score > bestScore) {
              bestScore = score;
              bestCandidate = candidate;
            }
          }
        }

        if (bestCandidate) {
          matchedEntry = bestCandidate;
          matchedBy = 'nome_aproximado';
        }
      }
    }

    if (matchedEntry) {
      const uniqueKey = `${matchedEntry.cls.id}::${matchedEntry.student.id}`;
      if (matchedIds.has(uniqueKey)) {
        duplicateLinesCount += 1;
      } else {
        matchedIds.add(uniqueKey);
        matchedItems.push({
          student: matchedEntry.student,
          cls: matchedEntry.cls,
          matchedBy,
          sourceLine: originalLine,
        });
      }
    } else {
      unmatchedLines.push(originalLine);
    }
  }

  return {
    parsedLinesCount,
    matchedItems,
    unmatchedLines,
    duplicateLinesCount,
  };
};
