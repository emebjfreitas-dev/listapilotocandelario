// server.ts
import "dotenv/config";
import express from "express";
import http from "http";
import crypto from "crypto";
import * as webpush from "web-push";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";

// src/data/officialMatrix2027.ts
var OFFICIAL_CLASS_ORDER = [
  "GRUPO 04 A",
  "GRUPO 04 B",
  "GRUPO 04 C",
  "GRUPO 04 D",
  "GRUPO 04 E",
  "GRUPO 05 A",
  "GRUPO 05 B",
  "GRUPO 05 C",
  "GRUPO 05 D",
  "GRUPO 05 E",
  "1\xBA ANO A",
  "1\xBA ANO B",
  "1\xBA ANO C",
  "1\xBA ANO D",
  "1\xBA ANO E",
  "1\xBA ANO F",
  "2\xBA ANO A",
  "2\xBA ANO B",
  "2\xBA ANO C",
  "2\xBA ANO D",
  "2\xBA ANO E",
  "2\xBA ANO F",
  "3\xBA ANO A",
  "3\xBA ANO B",
  "3\xBA ANO C",
  "3\xBA ANO D",
  "3\xBA ANO E",
  "3\xBA ANO F",
  "4\xBA ANO A",
  "4\xBA ANO B",
  "4\xBA ANO C",
  "4\xBA ANO D",
  "4\xBA ANO E",
  "4\xBA ANO F",
  "4\xBA ANO G",
  "5\xBA ANO A",
  "5\xBA ANO B",
  "5\xBA ANO C",
  "5\xBA ANO D",
  "5\xBA ANO E"
];
var OFFICIAL_CLASS_ORDER_INDEX = new Map(
  OFFICIAL_CLASS_ORDER.map((name, idx) => [name.toUpperCase(), idx])
);
var OFFICIAL_SCHOOL_MATRIX_2027 = [
  // =========================================================================
  // ORDEM OFICIAL PEDAGÓGICA (40 TURMAS: GRUPO 04 A..E → GRUPO 05 A..E → 1º..5º ANO)
  // =========================================================================
  {
    id: "g04a",
    turmaAbrev: "G4A",
    teacherName: "DENISE STEFANIN VIEIRA NICOLAU",
    teacherEmail: "denise.nicolau@educacao.jundiai.sp.gov.br",
    name: "GRUPO 04 A",
    grade: "Educa\xE7\xE3o Infantil (Grupo 04)",
    room: "SALA 01 / T\xC9RREO",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "1\xAA ETAPA PR\xC9-ESCOLA 4A MANHA ANUAL",
    sedExpectedStudents: 23,
    classeSedCode: "300497174",
    pronoun: "PROFESSORA",
    teacherFirstName: "DENISE",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "STELLA MARIS PRADO COSTA FERRARI",
    englishTeacher: "ELAINE CRISTINA DA SILVA",
    presenceRate: 96,
    isPending: false
  },
  {
    id: "g04b",
    turmaAbrev: "G4B",
    teacherName: "BIANCA MACEDO DA SILVA",
    teacherEmail: "bianca.macedo@educacao.jundiai.sp.gov.br",
    name: "GRUPO 04 B",
    grade: "Educa\xE7\xE3o Infantil (Grupo 04)",
    room: "SALA 02 / T\xC9RREO",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "1\xAA ETAPA PR\xC9-ESCOLA 4B MANHA ANUAL",
    sedExpectedStudents: 22,
    classeSedCode: "300497175",
    pronoun: "PROFESSORA",
    teacherFirstName: "BIANCA",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "STELLA MARIS PRADO COSTA FERRARI",
    englishTeacher: "ELAINE CRISTINA DA SILVA",
    presenceRate: 95,
    isPending: false
  },
  {
    id: "g04c",
    turmaAbrev: "G4C",
    teacherName: "LUANA VANESSA MEZAVILA VIEIRA",
    teacherEmail: "luana.mezavila@educacao.jundiai.sp.gov.br",
    name: "GRUPO 04 C",
    grade: "Educa\xE7\xE3o Infantil (Grupo 04)",
    room: "SALA 03 / T\xC9RREO",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "1\xAA ETAPA PR\xC9-ESCOLA 4C MANHA ANUAL",
    sedExpectedStudents: 21,
    classeSedCode: "300497177",
    pronoun: "PROFESSORA",
    teacherFirstName: "LUANA",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "STELLA MARIS PRADO COSTA FERRARI",
    englishTeacher: "ELAINE CRISTINA DA SILVA",
    presenceRate: 94,
    isPending: true
  },
  {
    id: "g04d",
    turmaAbrev: "G4D",
    teacherName: "ANA LAURA DOBRE FERREIRA HERMANN",
    teacherEmail: "ana.hermann@educacao.jundiai.sp.gov.br",
    name: "GRUPO 04 D",
    grade: "Educa\xE7\xE3o Infantil (Grupo 04)",
    room: "SALA 01 / T\xC9RREO",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "1\xAA ETAPA PR\xC9-ESCOLA 4D TARDE ANUAL",
    sedExpectedStudents: 22,
    classeSedCode: "300497179",
    pronoun: "PROFESSORA",
    teacherFirstName: "ANA LAURA",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "AC\xC1CIA FERNANDES DE ALBUQUERQUE DA SILVA",
    englishTeacher: "GIOVANNA CHAGAS FERREIRA",
    presenceRate: 95,
    isPending: false
  },
  {
    id: "g04e",
    turmaAbrev: "G4E",
    teacherName: "BARBARA BUENO FIALHO DE LIMA",
    teacherEmail: "barbara.lima@educacao.jundiai.sp.gov.br",
    name: "GRUPO 04 E",
    grade: "Educa\xE7\xE3o Infantil (Grupo 04)",
    room: "SALA 02 / T\xC9RREO",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "1\xAA ETAPA PR\xC9-ESCOLA 4E TARDE ANUAL",
    sedExpectedStudents: 20,
    classeSedCode: "300497181",
    pronoun: "PROFESSORA",
    teacherFirstName: "BARBARA",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "AC\xC1CIA FERNANDES DE ALBUQUERQUE DA SILVA",
    englishTeacher: "GIOVANNA CHAGAS FERREIRA",
    presenceRate: 93,
    isPending: true
  },
  {
    id: "g05a",
    turmaAbrev: "G5A",
    teacherName: "GESICA REGINA PICCOLO",
    teacherEmail: "gesica.piccolo@educacao.jundiai.sp.gov.br",
    name: "GRUPO 05 A",
    grade: "Educa\xE7\xE3o Infantil (Grupo 05)",
    room: "SALA 04 / T\xC9RREO",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "2\xAA ETAPA PR\xC9-ESCOLA 5A MANHA ANUAL",
    sedExpectedStudents: 26,
    classeSedCode: "300497186",
    pronoun: "PROFESSORA",
    teacherFirstName: "GESICA",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "STELLA MARIS PRADO COSTA FERRARI",
    englishTeacher: "ELAINE CRISTINA DA SILVA",
    presenceRate: 96,
    isPending: false
  },
  {
    id: "g05b",
    turmaAbrev: "G5B",
    teacherName: "LUCIMEIRE CARVALHO PEROBELLI",
    teacherEmail: "lucimeire.perobelli@educacao.jundiai.sp.gov.br",
    name: "GRUPO 05 B",
    grade: "Educa\xE7\xE3o Infantil (Grupo 05)",
    room: "SALA 05 / T\xC9RREO",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "2\xAA ETAPA PR\xC9-ESCOLA 5B MANHA ANUAL",
    sedExpectedStudents: 25,
    classeSedCode: "300497187",
    pronoun: "PROFESSORA",
    teacherFirstName: "LUCIMEIRE",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "STELLA MARIS PRADO COSTA FERRARI",
    englishTeacher: "ELAINE CRISTINA DA SILVA",
    presenceRate: 94,
    isPending: true
  },
  {
    id: "g05c",
    turmaAbrev: "G5C",
    teacherName: "MARIANA CRISTINA DE LIMA C GONCALVES",
    teacherEmail: "mariana.cristina@educacao.jundiai.sp.gov.br",
    name: "GRUPO 05 C",
    grade: "Educa\xE7\xE3o Infantil (Grupo 05)",
    room: "SALA 03 / T\xC9RREO",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "2\xAA ETAPA PR\xC9-ESCOLA 5C TARDE ANUAL",
    sedExpectedStudents: 24,
    classeSedCode: "300497188",
    pronoun: "PROFESSORA",
    teacherFirstName: "MARIANA CRISTINA",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "AC\xC1CIA FERNANDES DE ALBUQUERQUE DA SILVA",
    englishTeacher: "GIOVANNA CHAGAS FERREIRA",
    presenceRate: 95,
    isPending: false
  },
  {
    id: "g05d",
    turmaAbrev: "G5D",
    teacherName: "FERNANDA BORGES",
    teacherEmail: "fernanda.borges@educacao.jundiai.sp.gov.br",
    name: "GRUPO 05 D",
    grade: "Educa\xE7\xE3o Infantil (Grupo 05)",
    room: "SALA 04 / T\xC9RREO",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "2\xAA ETAPA PR\xC9-ESCOLA 5D TARDE ANUAL",
    sedExpectedStudents: 25,
    classeSedCode: "300497192",
    pronoun: "PROFESSORA",
    teacherFirstName: "FERNANDA",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "AC\xC1CIA FERNANDES DE ALBUQUERQUE DA SILVA",
    englishTeacher: "GIOVANNA CHAGAS FERREIRA",
    presenceRate: 94,
    isPending: false
  },
  {
    id: "g05e",
    turmaAbrev: "G5E",
    teacherName: "TURMA VAGA",
    teacherEmail: "vaga.g5e@educacao.jundiai.sp.gov.br",
    name: "GRUPO 05 E",
    grade: "Educa\xE7\xE3o Infantil (Grupo 05)",
    room: "SALA 05 / T\xC9RREO",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "2\xAA ETAPA PR\xC9-ESCOLA 5E TARDE ANUAL",
    sedExpectedStudents: 24,
    classeSedCode: "300497194",
    pronoun: "",
    teacherFirstName: "TURMA VAGA",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "AC\xC1CIA FERNANDES DE ALBUQUERQUE DA SILVA",
    englishTeacher: "GIOVANNA CHAGAS FERREIRA",
    presenceRate: 92,
    isPending: true,
    isVaga: true
  },
  {
    id: "1a",
    turmaAbrev: "1A",
    teacherName: "SIMONE DE SOUZA",
    teacherEmail: "simone.souza@educacao.jundiai.sp.gov.br",
    name: "1\xBA ANO A",
    grade: "Ensino Fundamental I (1\xBA Ano)",
    room: "SALA 10 / 1\xBA ANDAR",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "1\xB0 ANO 1A MANHA ANUAL",
    sedExpectedStudents: 26,
    classeSedCode: "300497195",
    pronoun: "PROFESSORA",
    teacherFirstName: "SIMONE",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "STELLA MARIS PRADO COSTA FERRARI",
    englishTeacher: "ELAINE CRISTINA DA SILVA",
    presenceRate: 96,
    isPending: false
  },
  {
    id: "1b",
    turmaAbrev: "1B",
    teacherName: "ROSANGELA DE PAULA",
    teacherEmail: "rosangela.paula@educacao.jundiai.sp.gov.br",
    name: "1\xBA ANO B",
    grade: "Ensino Fundamental I (1\xBA Ano)",
    room: "SALA 11 / 1\xBA ANDAR",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "1\xB0 ANO 1B MANHA ANUAL",
    sedExpectedStudents: 25,
    classeSedCode: "300497196",
    pronoun: "PROFESSORA",
    teacherFirstName: "ROSANGELA",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "STELLA MARIS PRADO COSTA FERRARI",
    englishTeacher: "ELAINE CRISTINA DA SILVA",
    presenceRate: 95,
    isPending: false
  },
  {
    id: "1c",
    turmaAbrev: "1C",
    teacherName: "SILVIA APARECIDA JUVENCIO AGUIAR",
    teacherEmail: "silvia.aguiar@educacao.jundiai.sp.gov.br",
    name: "1\xBA ANO C",
    grade: "Ensino Fundamental I (1\xBA Ano)",
    room: "SALA 12 / 1\xBA ANDAR",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "1\xB0 ANO 1C MANHA ANUAL",
    sedExpectedStudents: 27,
    classeSedCode: "300497197",
    pronoun: "PROFESSORA",
    teacherFirstName: "SILVIA APARECIDA",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "STELLA MARIS PRADO COSTA FERRARI",
    englishTeacher: "ELAINE CRISTINA DA SILVA",
    presenceRate: 94,
    isPending: false
  },
  {
    id: "1d",
    turmaAbrev: "1D",
    teacherName: "CAROL DE ASSIS FERREIRA SILVA",
    teacherEmail: "carol.silva@educacao.jundiai.sp.gov.br",
    name: "1\xBA ANO D",
    grade: "Ensino Fundamental I (1\xBA Ano)",
    room: "SALA 10 / 1\xBA ANDAR",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "1\xB0 ANO 1D TARDE ANUAL",
    sedExpectedStudents: 26,
    classeSedCode: "300497198",
    pronoun: "PROFESSORA",
    teacherFirstName: "CAROL",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "FERNANDA MIHO WATANABE ARANHA",
    englishTeacher: "LYGEA DE SOUZA RAMOS",
    presenceRate: 95,
    isPending: false
  },
  {
    id: "1e",
    turmaAbrev: "1E",
    teacherName: "TURMA VAGA",
    teacherEmail: "vaga.1e@educacao.jundiai.sp.gov.br",
    name: "1\xBA ANO E",
    grade: "Ensino Fundamental I (1\xBA Ano)",
    room: "SALA 11 / 1\xBA ANDAR",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "1\xB0 ANO 1E TARDE ANUAL",
    sedExpectedStudents: 25,
    classeSedCode: "300497199",
    pronoun: "",
    teacherFirstName: "TURMA VAGA",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "FERNANDA MIHO WATANABE ARANHA",
    englishTeacher: "LYGEA DE SOUZA RAMOS",
    presenceRate: 91,
    isPending: true,
    isVaga: true
  },
  {
    id: "1f",
    turmaAbrev: "1F",
    teacherName: "GIULIA BALAN GARCIA PATEZ",
    teacherEmail: "giulia.patez@educacao.jundiai.sp.gov.br",
    name: "1\xBA ANO F",
    grade: "Ensino Fundamental I (1\xBA Ano)",
    room: "SALA 12 / 1\xBA ANDAR",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "1\xB0 ANO 1F TARDE ANUAL",
    sedExpectedStudents: 26,
    classeSedCode: "300497200",
    pronoun: "PROFESSORA",
    teacherFirstName: "GIULIA",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "FERNANDA MIHO WATANABE ARANHA",
    englishTeacher: "LYGEA DE SOUZA RAMOS",
    presenceRate: 94,
    isPending: false
  },
  {
    id: "2a",
    turmaAbrev: "2A",
    teacherName: "SILVIA HELENA DE FREITAS RESTINO",
    teacherEmail: "silvia.restino@educacao.jundiai.sp.gov.br",
    name: "2\xBA ANO A",
    grade: "Ensino Fundamental I (2\xBA Ano)",
    room: "SALA 05 / 1\xBA ANDAR",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "2\xB0 ANO 2A MANHA ANUAL",
    sedExpectedStudents: 28,
    classeSedCode: "300497217",
    pronoun: "PROFESSORA",
    teacherFirstName: "SILVIA HELENA",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "PEDRO HENRIQUE DA ROSA",
    englishTeacher: "ALESSANDRA ISCARO COSTA",
    presenceRate: 96,
    isPending: false
  },
  {
    id: "2b",
    turmaAbrev: "2B",
    teacherName: "VIVIANE GUIDI",
    teacherEmail: "viviane.guidi@educacao.jundiai.sp.gov.br",
    name: "2\xBA ANO B",
    grade: "Ensino Fundamental I (2\xBA Ano)",
    room: "SALA 06 / 1\xBA ANDAR",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "2\xB0 ANO 2B MANHA ANUAL",
    sedExpectedStudents: 27,
    classeSedCode: "300497218",
    pronoun: "PROFESSORA",
    teacherFirstName: "VIVIANE",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "PEDRO HENRIQUE DA ROSA",
    englishTeacher: "ALESSANDRA ISCARO COSTA",
    presenceRate: 95,
    isPending: false
  },
  {
    id: "2c",
    turmaAbrev: "2C",
    teacherName: "ELAINE CRISTIANE DE SOUZA BRITO NETTO",
    teacherEmail: "elaine.netto@educacao.jundiai.sp.gov.br",
    name: "2\xBA ANO C",
    grade: "Ensino Fundamental I (2\xBA Ano)",
    room: "SALA 07 / 1\xBA ANDAR",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "2\xB0 ANO 2C MANHA ANUAL",
    sedExpectedStudents: 27,
    classeSedCode: "300497219",
    pronoun: "PROFESSORA",
    teacherFirstName: "ELAINE CRISTIANE",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "PEDRO HENRIQUE DA ROSA",
    englishTeacher: "ALESSANDRA ISCARO COSTA",
    presenceRate: 95,
    isPending: false
  },
  {
    id: "2d",
    turmaAbrev: "2D",
    teacherName: "RITA APARECIDA DA SILVA",
    teacherEmail: "rita.aparecida@educacao.jundiai.sp.gov.br",
    name: "2\xBA ANO D",
    grade: "Ensino Fundamental I (2\xBA Ano)",
    room: "SALA 08 / 1\xBA ANDAR",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "2\xB0 ANO 2D TARDE ANUAL",
    sedExpectedStudents: 28,
    classeSedCode: "300497222",
    pronoun: "PROFESSORA",
    teacherFirstName: "RITA APARECIDA",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "FERNANDA MIHO WATANABE ARANHA",
    englishTeacher: "LYGEA DE SOUZA RAMOS",
    presenceRate: 94,
    isPending: false
  },
  {
    id: "2e",
    turmaAbrev: "2E",
    teacherName: "VANESSA DOS SANTOS",
    teacherEmail: "vanessa.santos@educacao.jundiai.sp.gov.br",
    name: "2\xBA ANO E",
    grade: "Ensino Fundamental I (2\xBA Ano)",
    room: "SALA 06 / 1\xBA ANDAR",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "2\xB0 ANO 2E TARDE ANUAL",
    sedExpectedStudents: 29,
    classeSedCode: "300497223",
    pronoun: "PROFESSORA",
    teacherFirstName: "VANESSA",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "FERNANDA MIHO WATANABE ARANHA",
    englishTeacher: "LYGEA DE SOUZA RAMOS",
    presenceRate: 93,
    isPending: true
  },
  {
    id: "2f",
    turmaAbrev: "2F",
    teacherName: "TURMA VAGA",
    teacherEmail: "vaga.2f@educacao.jundiai.sp.gov.br",
    name: "2\xBA ANO F",
    grade: "Ensino Fundamental I (2\xBA Ano)",
    room: "SALA 07 / 1\xBA ANDAR",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "2\xB0 ANO 2F TARDE ANUAL",
    sedExpectedStudents: 30,
    classeSedCode: "300497224",
    pronoun: "",
    teacherFirstName: "TURMA VAGA",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "FERNANDA MIHO WATANABE ARANHA",
    englishTeacher: "LYGEA DE SOUZA RAMOS",
    presenceRate: 90,
    isPending: true,
    isVaga: true
  },
  {
    id: "3a",
    turmaAbrev: "3A",
    teacherName: "ANA LUCIA SILVA MACHADO VILAS BOAS",
    teacherEmail: "ana.boas@educacao.jundiai.sp.gov.br",
    name: "3\xBA ANO A",
    grade: "Ensino Fundamental I (3\xBA Ano)",
    room: "SALA 13 / 2\xBA ANDAR",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "3\xB0 ANO 3A MANHA ANUAL",
    sedExpectedStudents: 32,
    classeSedCode: "300497230",
    pronoun: "PROFESSORA",
    teacherFirstName: "ANA LUCIA",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "PEDRO HENRIQUE DA ROSA",
    englishTeacher: "ALESSANDRA ISCARO COSTA",
    presenceRate: 95,
    isPending: false
  },
  {
    id: "3b",
    turmaAbrev: "3B",
    teacherName: "MARINA ANTONIO PETRAQUIM",
    teacherEmail: "marina.petraquim@educacao.jundiai.sp.gov.br",
    name: "3\xBA ANO B",
    grade: "Ensino Fundamental I (3\xBA Ano)",
    room: "SALA 14 / 2\xBA ANDAR",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "3\xB0 ANO 3B MANHA ANUAL",
    sedExpectedStudents: 31,
    classeSedCode: "300497239",
    pronoun: "PROFESSORA",
    teacherFirstName: "MARINA",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "PEDRO HENRIQUE DA ROSA",
    englishTeacher: "ALESSANDRA ISCARO COSTA",
    presenceRate: 94,
    isPending: false
  },
  {
    id: "3c",
    turmaAbrev: "3C",
    teacherName: "IARA APARECIDA VILLELA ROSSI",
    teacherEmail: "iara.villela@educacao.jundiai.sp.gov.br",
    name: "3\xBA ANO C",
    grade: "Ensino Fundamental I (3\xBA Ano)",
    room: "SALA 15 / 2\xBA ANDAR",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "3\xB0 ANO 3C MANHA ANUAL",
    sedExpectedStudents: 31,
    classeSedCode: "300497241",
    pronoun: "PROFESSORA",
    teacherFirstName: "IARA APARECIDA",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "PEDRO HENRIQUE DA ROSA",
    englishTeacher: "ALESSANDRA ISCARO COSTA",
    presenceRate: 96,
    isPending: false
  },
  {
    id: "3d",
    turmaAbrev: "3D",
    teacherName: "MARIA APARECIDA FERREIRA DE LIMA",
    teacherEmail: "maria.ferreira@educacao.jundiai.sp.gov.br",
    name: "3\xBA ANO D",
    grade: "Ensino Fundamental I (3\xBA Ano)",
    room: "SALA 08 / 1\xBA ANDAR",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "3\xB0 ANO 3D TARDE ANUAL",
    sedExpectedStudents: 30,
    classeSedCode: "300497243",
    pronoun: "PROFESSORA",
    teacherFirstName: "MARIA APARECIDA",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "FERNANDA MIHO WATANABE ARANHA",
    englishTeacher: "LYGEA DE SOUZA RAMOS",
    presenceRate: 94,
    isPending: false
  },
  {
    id: "3e",
    turmaAbrev: "3E",
    teacherName: "CAMILO LISBOA ANDRE CARDOSO",
    teacherEmail: "camilo.lisboa@educacao.jundiai.sp.gov.br",
    name: "3\xBA ANO E",
    grade: "Ensino Fundamental I (3\xBA Ano)",
    room: "SALA 13 / 2\xBA ANDAR",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "3\xB0 ANO 3E TARDE ANUAL",
    sedExpectedStudents: 29,
    classeSedCode: "300497244",
    pronoun: "PROFESSOR",
    teacherFirstName: "CAMILO",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "FERNANDA MIHO WATANABE ARANHA",
    englishTeacher: "LYGEA DE SOUZA RAMOS",
    presenceRate: 95,
    isPending: false
  },
  {
    id: "3f",
    turmaAbrev: "3F",
    teacherName: "ANA PAULA PEREIRA DE ARAUJO",
    teacherEmail: "ana.araujo19@educacao.jundiai.sp.gov.br",
    name: "3\xBA ANO F",
    grade: "Ensino Fundamental I (3\xBA Ano)",
    room: "SALA 14 / 2\xBA ANDAR",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "3\xB0 ANO 3F TARDE ANUAL",
    sedExpectedStudents: 30,
    classeSedCode: "300497245",
    pronoun: "PROFESSORA",
    teacherFirstName: "ANA PAULA",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "FERNANDA MIHO WATANABE ARANHA",
    englishTeacher: "LYGEA DE SOUZA RAMOS",
    presenceRate: 93,
    isPending: true
  },
  {
    id: "4a",
    turmaAbrev: "4A",
    teacherName: "ADILIA DE LOURDES ARAUJO DA SILVA",
    teacherEmail: "adilia.lourdes@educacao.jundiai.sp.gov.br",
    name: "4\xBA ANO A",
    grade: "Ensino Fundamental I (4\xBA Ano)",
    room: "SALA 16 / 2\xBA ANDAR",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "4\xB0 ANO 4A MANHA ANUAL",
    sedExpectedStudents: 31,
    classeSedCode: "300497247",
    pronoun: "PROFESSORA",
    teacherFirstName: "ADILIA",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "PEDRO HENRIQUE DA ROSA",
    englishTeacher: "ALESSANDRA ISCARO COSTA",
    presenceRate: 95,
    isPending: false
  },
  {
    id: "4b",
    turmaAbrev: "4B",
    teacherName: "HELENA CONSTANCA FERRAZ",
    teacherEmail: "helena.ferraz@educacao.jundiai.sp.gov.br",
    name: "4\xBA ANO B",
    grade: "Ensino Fundamental I (4\xBA Ano)",
    room: "SALA 17 / 2\xBA ANDAR",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "4\xB0 ANO 4B MANHA ANUAL",
    sedExpectedStudents: 30,
    classeSedCode: "300497249",
    pronoun: "PROFESSORA",
    teacherFirstName: "HELENA",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "PEDRO HENRIQUE DA ROSA",
    englishTeacher: "ALESSANDRA ISCARO COSTA",
    presenceRate: 94,
    isPending: true
  },
  {
    id: "4c",
    turmaAbrev: "4C",
    teacherName: "CLEONICE DE MELO LIMA BATISTELA",
    teacherEmail: "cleonice.batistela@educacao.jundiai.sp.gov.br",
    name: "4\xBA ANO C",
    grade: "Ensino Fundamental I (4\xBA Ano)",
    room: "SALA 18 / 2\xBA ANDAR",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "4\xB0 ANO 4C MANHA ANUAL",
    sedExpectedStudents: 31,
    classeSedCode: "300497251",
    pronoun: "PROFESSORA",
    teacherFirstName: "CLEONICE",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "PEDRO HENRIQUE DA ROSA",
    englishTeacher: "ALESSANDRA ISCARO COSTA",
    presenceRate: 96,
    isPending: false
  },
  {
    id: "4d",
    turmaAbrev: "4D",
    teacherName: "MARIA JULIA CEZAR VILHENA",
    teacherEmail: "maria.julia@educacao.jundiai.sp.gov.br",
    name: "4\xBA ANO D",
    grade: "Ensino Fundamental I (4\xBA Ano)",
    room: "SALA 15 / 2\xBA ANDAR",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "4\xB0 ANO 4D TARDE ANUAL",
    sedExpectedStudents: 30,
    classeSedCode: "300497253",
    pronoun: "PROFESSORA",
    teacherFirstName: "MARIA JULIA",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "FERNANDA MIHO WATANABE ARANHA",
    englishTeacher: "LYGEA DE SOUZA RAMOS",
    presenceRate: 94,
    isPending: false
  },
  {
    id: "4e",
    turmaAbrev: "4E",
    teacherName: "MARIA PAULA SILVA LIMA ALMEIDA",
    teacherEmail: "maria.almeida16@educacao.jundiai.sp.gov.br",
    name: "4\xBA ANO E",
    grade: "Ensino Fundamental I (4\xBA Ano)",
    room: "SALA 16 / 2\xBA ANDAR",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "4\xB0 ANO 4E TARDE ANUAL",
    sedExpectedStudents: 31,
    classeSedCode: "300497255",
    pronoun: "PROFESSORA",
    teacherFirstName: "MARIA PAULA",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "FERNANDA MIHO WATANABE ARANHA",
    englishTeacher: "LYGEA DE SOUZA RAMOS",
    presenceRate: 95,
    isPending: false
  },
  {
    id: "4f",
    turmaAbrev: "4F",
    teacherName: "FABIO RAMOS DOS SANTOS",
    teacherEmail: "fabio.santos@educacao.jundiai.sp.gov.br",
    name: "4\xBA ANO F",
    grade: "Ensino Fundamental I (4\xBA Ano)",
    room: "SALA 17 / 2\xBA ANDAR",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "4\xB0 ANO 4F TARDE ANUAL",
    sedExpectedStudents: 30,
    classeSedCode: "300497257",
    pronoun: "PROFESSOR",
    teacherFirstName: "FABIO",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "FERNANDA MIHO WATANABE ARANHA",
    englishTeacher: "LYGEA DE SOUZA RAMOS",
    presenceRate: 93,
    isPending: true
  },
  {
    id: "4g",
    turmaAbrev: "4G",
    teacherName: "RAFAELA APARECIDA GOBBI",
    teacherEmail: "rafaela.gobbi@educacao.jundiai.sp.gov.br",
    name: "4\xBA ANO G",
    grade: "Ensino Fundamental I (4\xBA Ano)",
    room: "SALA 18 / 2\xBA ANDAR",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "4\xB0 ANO 4G TARDE ANUAL",
    sedExpectedStudents: 29,
    classeSedCode: "300497259",
    pronoun: "PROFESSORA",
    teacherFirstName: "RAFAELA",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "FERNANDA MIHO WATANABE ARANHA",
    englishTeacher: "LYGEA DE SOUZA RAMOS",
    presenceRate: 95,
    isPending: false
  },
  {
    id: "5a",
    turmaAbrev: "5A",
    teacherName: "SANDRA REGINA MOTA FURLAN",
    teacherEmail: "sandra.furlan@educacao.jundiai.sp.gov.br",
    name: "5\xBA ANO A",
    grade: "Ensino Fundamental I (5\xBA Ano)",
    room: "SALA 19 / 2\xBA ANDAR",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "5\xB0 ANO 5A MANHA ANUAL",
    sedExpectedStudents: 32,
    classeSedCode: "300497261",
    pronoun: "PROFESSORA",
    teacherFirstName: "SANDRA",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "PEDRO HENRIQUE DA ROSA",
    englishTeacher: "ALESSANDRA ISCARO COSTA",
    presenceRate: 96,
    isPending: false
  },
  {
    id: "5b",
    turmaAbrev: "5B",
    teacherName: "ANA MARIA DE LIMA ALVARES NOGUEIRA",
    teacherEmail: "ana.alvares@educacao.jundiai.sp.gov.br",
    name: "5\xBA ANO B",
    grade: "Ensino Fundamental I (5\xBA Ano)",
    room: "SALA 20 / 2\xBA ANDAR",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "5\xB0 ANO 5B MANHA ANUAL",
    sedExpectedStudents: 31,
    classeSedCode: "300497263",
    pronoun: "PROFESSORA",
    teacherFirstName: "ANA MARIA",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "PEDRO HENRIQUE DA ROSA",
    englishTeacher: "ALESSANDRA ISCARO COSTA",
    presenceRate: 95,
    isPending: false
  },
  {
    id: "5c",
    turmaAbrev: "5C",
    teacherName: "MARCOS FERNANDES",
    teacherEmail: "marcos.fernandes@educacao.jundiai.sp.gov.br",
    name: "5\xBA ANO C",
    grade: "Ensino Fundamental I (5\xBA Ano)",
    room: "SALA 21 / 2\xBA ANDAR",
    periodo: "MANH\xC3",
    shift: "Turno Manh\xE3",
    sedClassName: "5\xB0 ANO 5C MANHA ANUAL",
    sedExpectedStudents: 32,
    classeSedCode: "300497265",
    pronoun: "PROFESSOR",
    teacherFirstName: "MARCOS",
    artTeacher: "YURI NICHOLAS TOFFANETTO",
    peTeacher: "PEDRO HENRIQUE DA ROSA",
    englishTeacher: "ALESSANDRA ISCARO COSTA",
    presenceRate: 97,
    isPending: false
  },
  {
    id: "5d",
    turmaAbrev: "5D",
    teacherName: "KARINA LAIS GALVAO TRIENTINI",
    teacherEmail: "karina.trientini@educacao.jundiai.sp.gov.br",
    name: "5\xBA ANO D",
    grade: "Ensino Fundamental I (5\xBA Ano)",
    room: "SALA 19 / 2\xBA ANDAR",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "5\xB0 ANO 5D TARDE ANUAL",
    sedExpectedStudents: 31,
    classeSedCode: "300497267",
    pronoun: "PROFESSORA",
    teacherFirstName: "KARINA",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "FERNANDA MIHO WATANABE ARANHA",
    englishTeacher: "LYGEA DE SOUZA RAMOS",
    presenceRate: 95,
    isPending: false
  },
  {
    id: "5e",
    turmaAbrev: "5E",
    teacherName: "AMANDA DE OLIVEIRA HONIGMANN STORANI",
    teacherEmail: "amanda.storani@educacao.jundiai.sp.gov.br",
    name: "5\xBA ANO E",
    grade: "Ensino Fundamental I (5\xBA Ano)",
    room: "SALA 20 / 2\xBA ANDAR",
    periodo: "TARDE",
    shift: "Turno Tarde",
    sedClassName: "5\xB0 ANO 5E TARDE ANUAL",
    sedExpectedStudents: 30,
    classeSedCode: "300497269",
    pronoun: "PROFESSORA",
    teacherFirstName: "AMANDA",
    artTeacher: "SOPHIA WOLF ZAROS",
    peTeacher: "FERNANDA MIHO WATANABE ARANHA",
    englishTeacher: "LYGEA DE SOUZA RAMOS",
    presenceRate: 96,
    isPending: false
  }
];

// src/data/mockData.ts
var formatDisplayNameFromEmail = (email) => {
  const prefix = email.split("@")[0] || "";
  if (prefix === "emebjfreitas") {
    return "Equipe Administrativa";
  }
  return prefix.replace(/\d+/g, "").split(".").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
};
var OFFICIAL_WHITELISTED_EMAILS = [
  "emebjfreitas@jundiai.sp.gov.br",
  "emebjfreitas@educacao.jundiai.sp.gov.br",
  "acacia.silva@educacao.jundiai.sp.gov.br",
  "adilia.lourdes@educacao.jundiai.sp.gov.br",
  "alessandra.costa@educacao.jundiai.sp.gov.br",
  "aline.araujo@educacao.jundiai.sp.gov.br",
  "amanda.storani@educacao.jundiai.sp.gov.br",
  "ana.alvares@educacao.jundiai.sp.gov.br",
  "ana.araujo19@educacao.jundiai.sp.gov.br",
  "ana.boas@educacao.jundiai.sp.gov.br",
  "ana.hermann@educacao.jundiai.sp.gov.br",
  "ana.prado@educacao.jundiai.sp.gov.br",
  "barbara.lima@educacao.jundiai.sp.gov.br",
  "beatriz.silva09@educacao.jundiai.sp.gov.br",
  "bianca.macedo@educacao.jundiai.sp.gov.br",
  "bruna.maximiano@educacao.jundiai.sp.gov.br",
  "camilo.lisboa@educacao.jundiai.sp.gov.br",
  "carol.silva@educacao.jundiai.sp.gov.br",
  "caroline.oliveira@educacao.jundiai.sp.gov.br",
  "cleonice.batistela@educacao.jundiai.sp.gov.br",
  "denis.braz@educacao.jundiai.sp.gov.br",
  "denise.nicolau@educacao.jundiai.sp.gov.br",
  "edmar.vinicius@educacao.jundiai.sp.gov.br",
  "elaine.netto@educacao.jundiai.sp.gov.br",
  "elaine.silva13@educacao.jundiai.sp.gov.br",
  "erika.mori@educacao.jundiai.sp.gov.br",
  "fabio.santos@educacao.jundiai.sp.gov.br",
  "fernanda.aranha@educacao.jundiai.sp.gov.br",
  "fernanda.borges@educacao.jundiai.sp.gov.br",
  "gesica.piccolo@educacao.jundiai.sp.gov.br",
  "giovana.rampin@educacao.jundiai.sp.gov.br",
  "giovanna.ferreira@educacao.jundiai.sp.gov.br",
  "giulia.patez@educacao.jundiai.sp.gov.br",
  "helena.ferraz@educacao.jundiai.sp.gov.br",
  "iara.villela@educacao.jundiai.sp.gov.br",
  "isabel.zanchin@educacao.jundiai.sp.gov.br",
  "isabella.correa@educacao.jundiai.sp.gov.br",
  "joana.leopoldino@educacao.jundiai.sp.gov.br",
  "karen.merlim@educacao.jundiai.sp.gov.br",
  "karina.trientini@educacao.jundiai.sp.gov.br",
  "layla.rocha@educacao.jundiai.sp.gov.br",
  "liana.poiani@educacao.jundiai.sp.gov.br",
  "lilian.gomes@educacao.jundiai.sp.gov.br",
  "lilian.rizzi@educacao.jundiai.sp.gov.br",
  "luana.mezavila@educacao.jundiai.sp.gov.br",
  "lucimeire.perobelli@educacao.jundiai.sp.gov.br",
  "luiza.kabata@educacao.jundiai.sp.gov.br",
  "lygea.ramos@educacao.jundiai.sp.gov.br",
  "marcelo.aguiar@educacao.jundiai.sp.gov.br",
  "marcos.fernandes@educacao.jundiai.sp.gov.br",
  "maria.almeida16@educacao.jundiai.sp.gov.br",
  "maria.ferreira@educacao.jundiai.sp.gov.br",
  "maria.julia@educacao.jundiai.sp.gov.br",
  "mariana.cristina@educacao.jundiai.sp.gov.br",
  "mariane.santos@educacao.jundiai.sp.gov.br",
  "marina.petraquim@educacao.jundiai.sp.gov.br",
  "monica.iamonti@educacao.jundiai.sp.gov.br",
  "patricia.araujo@educacao.jundiai.sp.gov.br",
  "pedro.rosa@educacao.jundiai.sp.gov.br",
  "priscila.damasceno@educacao.jundiai.sp.gov.br",
  "rafaela.gobbi@educacao.jundiai.sp.gov.br",
  "rita.aparecida@educacao.jundiai.sp.gov.br",
  "roberta.saldanha@educacao.jundiai.sp.gov.br",
  "rosangela.paula@educacao.jundiai.sp.gov.br",
  "sandra.furlan@educacao.jundiai.sp.gov.br",
  "silvia.aguiar@educacao.jundiai.sp.gov.br",
  "silvia.restino@educacao.jundiai.sp.gov.br",
  "simone.souza@educacao.jundiai.sp.gov.br",
  "sophia.zaros@educacao.jundiai.sp.gov.br",
  "stella.ferrari@educacao.jundiai.sp.gov.br",
  "tais.buzetto@educacao.jundiai.sp.gov.br",
  "vanessa.santos@educacao.jundiai.sp.gov.br",
  "viviane.guidi@educacao.jundiai.sp.gov.br",
  "yuri.nicholas@educacao.jundiai.sp.gov.br"
];
var PEB2_SPECIALISTS_BY_EMAIL = {
  "yuri.nicholas@educacao.jundiai.sp.gov.br": {
    fullName: "YURI NICHOLAS TOFFANETTO",
    firstName: "YURI NICHOLAS",
    pronoun: "PROFESSOR",
    subject: "ARTE"
  },
  "sophia.zaros@educacao.jundiai.sp.gov.br": {
    fullName: "SOPHIA WOLF ZAROS",
    firstName: "SOPHIA",
    pronoun: "PROFESSORA",
    subject: "ARTE"
  },
  "stella.ferrari@educacao.jundiai.sp.gov.br": {
    fullName: "STELLA MARIS PRADO COSTA FERRARI",
    firstName: "STELLA MARIS",
    pronoun: "PROFESSORA",
    subject: "EDUCA\xC7\xC3O F\xCDSICA"
  },
  "acacia.silva@educacao.jundiai.sp.gov.br": {
    fullName: "AC\xC1CIA FERNANDES DE ALBUQUERQUE DA SILVA",
    firstName: "AC\xC1CIA",
    pronoun: "PROFESSORA",
    subject: "EDUCA\xC7\xC3O F\xCDSICA"
  },
  "pedro.rosa@educacao.jundiai.sp.gov.br": {
    fullName: "PEDRO HENRIQUE DA ROSA",
    firstName: "PEDRO HENRIQUE",
    pronoun: "PROFESSOR",
    subject: "EDUCA\xC7\xC3O F\xCDSICA"
  },
  "fernanda.aranha@educacao.jundiai.sp.gov.br": {
    fullName: "FERNANDA MIHO WATANABE ARANHA",
    firstName: "FERNANDA MIHO",
    pronoun: "PROFESSORA",
    subject: "EDUCA\xC7\xC3O F\xCDSICA"
  },
  "elaine.silva13@educacao.jundiai.sp.gov.br": {
    fullName: "ELAINE CRISTINA DA SILVA",
    firstName: "ELAINE CRISTINA",
    pronoun: "PROFESSORA",
    subject: "L\xCDNGUA INGLESA"
  },
  "giovanna.ferreira@educacao.jundiai.sp.gov.br": {
    fullName: "GIOVANNA CHAGAS FERREIRA",
    firstName: "GIOVANNA",
    pronoun: "PROFESSORA",
    subject: "L\xCDNGUA INGLESA"
  },
  "lygea.ramos@educacao.jundiai.sp.gov.br": {
    fullName: "LYGEA DE SOUZA RAMOS",
    firstName: "LYGEA",
    pronoun: "PROFESSORA",
    subject: "L\xCDNGUA INGLESA"
  },
  "alessandra.costa@educacao.jundiai.sp.gov.br": {
    fullName: "ALESSANDRA ISCARO COSTA",
    firstName: "ALESSANDRA",
    pronoun: "PROFESSORA",
    subject: "L\xCDNGUA INGLESA"
  }
};
var INITIAL_AUTHORIZED_USERS = Array.from(
  new Set(OFFICIAL_WHITELISTED_EMAILS.map((e) => e.trim().toLowerCase()))
).map((email, idx) => {
  const isAdminAccount = email.startsWith("emebjfreitas@");
  if (isAdminAccount) {
    return {
      id: `usr-official-${idx + 1}`,
      email,
      name: formatDisplayNameFromEmail(email),
      role: "admin",
      teacherRoleType: "admin",
      pronoun: "DIRE\xC7\xC3O",
      firstName: "DIRE\xC7\xC3O",
      subjectName: "GEST\xC3O / ADMIN",
      assignedClassId: "all",
      assignedClassIds: ["all"],
      assignedClassName: "Todas as 40 Turmas (Acesso Pleno)",
      assignedClassNames: ["Todas as 40 Turmas (Acesso Pleno)"],
      active: true,
      createdAt: "02/02/2027"
    };
  }
  const regenteMatches = OFFICIAL_SCHOOL_MATRIX_2027.filter(
    (m) => m.teacherEmail.trim().toLowerCase() === email
  );
  if (regenteMatches.length > 0) {
    const primary = regenteMatches[0];
    const classIds = regenteMatches.map((m) => m.id);
    const classNames = regenteMatches.map(
      (m) => `${m.name} (${m.periodo === "MANH\xC3" ? "Manh\xE3" : "Tarde"})`
    );
    return {
      id: `usr-official-${idx + 1}`,
      email,
      name: `${primary.pronoun === "PROFESSOR" ? "Prof." : "Prof\xAA."} ${primary.teacherName}`,
      role: "usuario",
      teacherRoleType: "peb1",
      pronoun: primary.pronoun,
      firstName: primary.teacherFirstName,
      subjectName: "REGENTE PEB I",
      assignedClassId: primary.id,
      assignedClassIds: classIds,
      assignedClassName: classNames.join(" + "),
      assignedClassNames: classNames,
      active: true,
      createdAt: "03/02/2027"
    };
  }
  const specialist = PEB2_SPECIALISTS_BY_EMAIL[email];
  if (specialist) {
    const specialistClasses = OFFICIAL_SCHOOL_MATRIX_2027.filter(
      (m) => m.artTeacher === specialist.fullName || m.peTeacher === specialist.fullName || m.englishTeacher === specialist.fullName
    );
    const abrevList = specialistClasses.map((m) => m.turmaAbrev).join(", ");
    return {
      id: `usr-official-${idx + 1}`,
      email,
      name: `${specialist.pronoun === "PROFESSOR" ? "Prof." : "Prof\xAA."} ${specialist.fullName}`,
      role: "peb2",
      teacherRoleType: "peb2",
      pronoun: specialist.pronoun,
      firstName: specialist.firstName,
      subjectName: specialist.subject,
      assignedClassId: "all",
      assignedClassIds: ["all"],
      assignedClassName: `PEB II (${specialist.subject}) \u2022 ${specialistClasses.length} Turmas (${abrevList})`,
      assignedClassNames: [`PEB II (${specialist.subject})`],
      active: true,
      createdAt: "03/02/2027"
    };
  }
  return {
    id: `usr-official-${idx + 1}`,
    email,
    name: `Prof(a). ${formatDisplayNameFromEmail(email).toUpperCase()}`,
    role: "peb2",
    teacherRoleType: "apoio",
    pronoun: "PROFESSOR(A)",
    firstName: formatDisplayNameFromEmail(email).split(" ")[0]?.toUpperCase() || "DOCENTE",
    assignedClassId: "all",
    assignedClassIds: ["all"],
    assignedClassName: "Todas as Turmas (Consulta / Apoio Pedag\xF3gico)",
    assignedClassNames: ["Todas as Turmas (Consulta / Apoio Pedag\xF3gico)"],
    active: true,
    createdAt: "03/02/2027"
  };
});
var APP_BASE_URL = import.meta.env?.BASE_URL || "/";
var APP_LOGO_URL = `${APP_BASE_URL}brasao-jundiai.png`;
var SCHOOL_WATERMARK_GALLERY = [
  "https://jundiai.sp.gov.br/noticias/wp-content/uploads/sites/32/2024/12/candelario-1-1536x1024.jpg",
  "https://jundiai.sp.gov.br/noticias/wp-content/uploads/sites/32/2022/07/inauguracao_emeb_candelario_de_freitas-404.jpg",
  "https://jundiai.sp.gov.br/noticias/wp-content/uploads/sites/32/2023/05/parque_naturalizado_emeb_candelario_de_freitas_pa-3-1536x1024.jpg",
  "https://jundiai.sp.gov.br/noticias/wp-content/uploads/sites/32/2021/11/grafite-emeb-candelario-77.jpg",
  "https://jundiai.sp.gov.br/noticias/wp-content/uploads/sites/32/2022/07/alunos-emeb-candelario-em-aula-de-chromebooks-laboratorio-maker_c_-27.jpg",
  "https://jundiai.sp.gov.br/noticias/wp-content/uploads/sites/32/2023/05/espaco-maker-fablab-emeb-candelario-formacao-alunos-para-uso-dos-chromebooks_fm_-4-1536x1024.jpg",
  "https://live.staticflickr.com/65535/51747624614_48845297df_b.jpg",
  `${APP_BASE_URL}escola-candelario.jpg`
];
var MONTHLY_SCHOOL_DAYS_2027 = [
  { month: "Fevereiro", monthNumber: 2, schoolDays: 16 },
  { month: "Mar\xE7o", monthNumber: 3, schoolDays: 22 },
  { month: "Abril", monthNumber: 4, schoolDays: 20 },
  { month: "Maio", monthNumber: 5, schoolDays: 20 },
  { month: "Junho", monthNumber: 6, schoolDays: 20 },
  { month: "Julho", monthNumber: 7, schoolDays: 10 },
  { month: "Agosto", monthNumber: 8, schoolDays: 22 },
  { month: "Setembro", monthNumber: 9, schoolDays: 20 },
  { month: "Outubro", monthNumber: 10, schoolDays: 20 },
  { month: "Novembro", monthNumber: 11, schoolDays: 18 },
  { month: "Dezembro", monthNumber: 12, schoolDays: 12 }
];
var getDefaultMonthlySchoolDaysMap = () => {
  const map = {};
  MONTHLY_SCHOOL_DAYS_2027.forEach((m) => {
    map[m.month] = m.schoolDays;
  });
  return map;
};
var OFFICIAL_2027_CLASSES_CONFIG = OFFICIAL_SCHOOL_MATRIX_2027.map((row) => ({
  ...row,
  totalStudents: row.sedExpectedStudents
}));
var INITIAL_CLASSES = OFFICIAL_SCHOOL_MATRIX_2027.map((cfg) => ({
  id: cfg.id,
  name: cfg.name,
  turmaAbrev: cfg.turmaAbrev,
  grade: cfg.grade,
  shift: cfg.shift,
  room: cfg.room,
  teacherName: cfg.teacherName,
  teacherEmail: cfg.teacherEmail,
  pronoun: cfg.pronoun,
  teacherFirstName: cfg.teacherFirstName,
  sedClassName: cfg.sedClassName,
  sedExpectedStudents: cfg.sedExpectedStudents,
  classeSedCode: cfg.classeSedCode,
  artTeacher: cfg.artTeacher,
  peTeacher: cfg.peTeacher,
  englishTeacher: cfg.englishTeacher,
  totalStudents: 0,
  presenceRate: 0,
  statusText: "Aguardando importa\xE7\xE3o de estudantes",
  isPending: false,
  students: [],
  monthlyAbsences: 0,
  classesHeld: 20,
  classesPlanned: 20,
  monthlySchoolDays: getDefaultMonthlySchoolDaysMap(),
  weeklyPerformance: [],
  pedagogicalNotes: "",
  isVaga: Boolean(cfg.isVaga),
  periodo: cfg.periodo
}));

// src/utils/serverValidation.ts
var FORBIDDEN_PROTO_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
var MAX_TRAVERSAL_DEPTH = 16;
var isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
var hasForbiddenPrototypeKey = (value, depth = 0, visited = /* @__PURE__ */ new Set()) => {
  if (depth > MAX_TRAVERSAL_DEPTH || value === null || typeof value !== "object") {
    return false;
  }
  if (visited.has(value)) return false;
  visited.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (hasForbiddenPrototypeKey(value[i], depth + 1, visited)) return true;
    }
    return false;
  }
  const keys = Object.getOwnPropertyNames(value);
  for (const key of keys) {
    if (FORBIDDEN_PROTO_KEYS.has(key)) return true;
    const child = value[key];
    if (hasForbiddenPrototypeKey(child, depth + 1, visited)) return true;
  }
  return false;
};
var ensureSafePayloadObject = (body) => {
  if (!isPlainObject(body)) {
    return { ok: false, error: "Corpo da requisi\xE7\xE3o JSON inv\xE1lido." };
  }
  if (hasForbiddenPrototypeKey(body)) {
    return {
      ok: false,
      error: "Payload rejeitado por conter chaves reservadas n\xE3o permitidas."
    };
  }
  return { ok: true, data: body };
};
var requireTrimmedString = (value, fieldLabel, maxLength = 500) => {
  if (typeof value !== "string") {
    return { ok: false, error: `${fieldLabel} deve ser uma string v\xE1lida.` };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: `${fieldLabel} \xE9 obrigat\xF3rio e n\xE3o pode ser vazio.` };
  }
  if (trimmed.length > maxLength) {
    return {
      ok: false,
      error: `${fieldLabel} excede o limite m\xE1ximo de ${maxLength} caracteres.`
    };
  }
  return { ok: true, data: trimmed };
};
var optionalTrimmedString = (value, fieldLabel, maxLength = 500) => {
  if (value === void 0 || value === null || value === "") {
    return { ok: true, data: void 0 };
  }
  if (typeof value !== "string") {
    return { ok: false, error: `${fieldLabel} deve ser texto.` };
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return {
      ok: false,
      error: `${fieldLabel} excede o limite m\xE1ximo de ${maxLength} caracteres.`
    };
  }
  return { ok: true, data: trimmed || void 0 };
};
var isValidIsoCalendarDate = (dateStr) => {
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2e3 || year > 2100 || month < 1 || month > 12 || day < 1) {
    return false;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
};
var isValidBrCalendarDate = (dateStr) => {
  const match = dateStr.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 2e3 || year > 2100 || month < 1 || month > 12 || day < 1) {
    return false;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
};
var isValidEmailFormat = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
var isInstitutionalEmailAddress = (email) => {
  const clean = email.trim().toLowerCase();
  if (!isValidEmailFormat(clean)) return false;
  return clean.endsWith("@educacao.jundiai.sp.gov.br") || clean === "emebjfreitas@jundiai.sp.gov.br";
};
var requireFiniteNonNegativeNumber = (value, fieldLabel, max = Number.MAX_SAFE_INTEGER) => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) {
    return {
      ok: false,
      error: `${fieldLabel} deve ser um n\xFAmero finito entre 0 e ${max}.`
    };
  }
  return { ok: true, data: n };
};
var validateAuthSessionRequest = (body, authHeader) => {
  if (body !== void 0 && body !== null && !isPlainObject(body)) {
    return { ok: false, error: "Corpo da requisi\xE7\xE3o de sess\xE3o inv\xE1lido." };
  }
  if (body && hasForbiddenPrototypeKey(body)) {
    return { ok: false, error: "Payload de sess\xE3o rejeitado por chaves proibidas." };
  }
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const bodyToken = isPlainObject(body) && typeof body.idToken === "string" ? body.idToken.trim() : "";
  const resolved = bearerToken || bodyToken;
  if (!resolved) {
    return { ok: false, error: "Token Firebase ID obrigat\xF3rio." };
  }
  if (resolved.length > 8192) {
    return { ok: false, error: "Token Firebase ID excede o tamanho permitido." };
  }
  return { ok: true, data: { idToken: resolved } };
};
var validateDriveTokenPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const tokenCheck = requireTrimmedString(base.data.accessToken, "accessToken", 4096);
  if (!tokenCheck.ok) return tokenCheck;
  if (tokenCheck.data.length <= 10) {
    return { ok: false, error: "accessToken inv\xE1lido ou muito curto." };
  }
  return { ok: true, data: { accessToken: tokenCheck.data } };
};
var validatePhotoUploadBinaryHeaders = (studentIdHeader, sha256Header, bodyBuffer) => {
  const studentCheck = requireTrimmedString(studentIdHeader, "x-student-id", 128);
  if (!studentCheck.ok) return studentCheck;
  if (!Buffer.isBuffer(bodyBuffer) || bodyBuffer.length === 0) {
    return { ok: false, error: "Corpo bin\xE1rio da foto \xE9 obrigat\xF3rio." };
  }
  if (bodyBuffer.length > 10 * 1024 * 1024) {
    return { ok: false, error: "Foto excede o limite de 10 MB." };
  }
  let cleanSha;
  if (sha256Header !== void 0 && sha256Header !== "") {
    const shaStr = String(sha256Header).trim();
    if (!/^[a-fA-F0-9]{64}$/.test(shaStr)) {
      return { ok: false, error: "Cabe\xE7alho x-file-sha256 inv\xE1lido." };
    }
    cleanSha = shaStr.toLowerCase();
  }
  return { ok: true, data: { studentId: studentCheck.data, sha256: cleanSha } };
};
var validatePhotoUploadPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const sid = requireTrimmedString(base.data.studentId, "studentId", 128);
  if (!sid.ok) return sid;
  const dataUrl = requireTrimmedString(
    base.data.photoDataUrl,
    "photoDataUrl",
    12 * 1024 * 1024
  );
  if (!dataUrl.ok) return dataUrl;
  return { ok: true, data: { studentId: sid.data, photoDataUrl: dataUrl.data } };
};
var validatePhotoBatchPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const { photos } = base.data;
  if (!Array.isArray(photos) || photos.length === 0) {
    return { ok: false, error: "Nenhuma foto fornecida no lote." };
  }
  if (photos.length > 500) {
    return { ok: false, error: "O lote JSON de fotos excede o m\xE1ximo de 500 itens por envio." };
  }
  const normalized = [];
  for (let i = 0; i < photos.length; i++) {
    const item = photos[i];
    if (!isPlainObject(item)) {
      return { ok: false, error: `Item #${i + 1} do lote de fotos inv\xE1lido.` };
    }
    const sid = requireTrimmedString(item.studentId, `photos[${i}].studentId`, 128);
    if (!sid.ok) return sid;
    const url = requireTrimmedString(
      item.photoDataUrl,
      `photos[${i}].photoDataUrl`,
      10 * 1024 * 1024
    );
    if (!url.ok) return url;
    const sha = optionalTrimmedString(item.sha256, `photos[${i}].sha256`, 64);
    if (!sha.ok) return sha;
    normalized.push({
      studentId: sid.data,
      photoDataUrl: url.data,
      sha256: sha.data
    });
  }
  return { ok: true, data: { photos: normalized } };
};
var validatePdfUploadPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const sid = requireTrimmedString(base.data.studentId, "studentId", 128);
  if (!sid.ok) return sid;
  const dataUrl = requireTrimmedString(
    base.data.pdfDataUrl,
    "pdfDataUrl",
    20 * 1024 * 1024
  );
  if (!dataUrl.ok) return dataUrl;
  return { ok: true, data: { studentId: sid.data, pdfDataUrl: dataUrl.data } };
};
var validatePdfBatchPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const { pdfs } = base.data;
  if (!Array.isArray(pdfs) || pdfs.length === 0) {
    return { ok: false, error: "Nenhum PDF fornecido no lote." };
  }
  if (pdfs.length > 300) {
    return { ok: false, error: "O lote JSON de PDFs excede o m\xE1ximo de 300 itens por envio." };
  }
  const normalized = [];
  for (let i = 0; i < pdfs.length; i++) {
    const item = pdfs[i];
    if (!isPlainObject(item)) {
      return { ok: false, error: `Item #${i + 1} do lote de PDFs inv\xE1lido.` };
    }
    const sid = requireTrimmedString(item.studentId, `pdfs[${i}].studentId`, 128);
    if (!sid.ok) return sid;
    const url = requireTrimmedString(
      item.pdfDataUrl,
      `pdfs[${i}].pdfDataUrl`,
      20 * 1024 * 1024
    );
    if (!url.ok) return url;
    const sha = optionalTrimmedString(item.sha256, `pdfs[${i}].sha256`, 64);
    if (!sha.ok) return sha;
    normalized.push({
      studentId: sid.data,
      pdfDataUrl: url.data,
      sha256: sha.data
    });
  }
  return { ok: true, data: { pdfs: normalized } };
};
var validateSchoolStateClassesPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const {
    classes,
    classesUpdatedAtMs,
    discoveredNominalPdfs,
    discoveredDrivePhotos,
    cloudLinks,
    opId
  } = base.data;
  if (!Array.isArray(classes) || classes.length === 0 || classes.length > 80) {
    return { ok: false, error: "Lista de turmas inv\xE1lida (deve conter de 1 a 80 turmas)." };
  }
  for (let i = 0; i < classes.length; i++) {
    const cls = classes[i];
    if (!isPlainObject(cls)) {
      return { ok: false, error: `Turma na posi\xE7\xE3o ${i} est\xE1 malformada.` };
    }
    const idCheck = requireTrimmedString(cls.id, `classes[${i}].id`, 80);
    if (!idCheck.ok) return idCheck;
    if (cls.students !== void 0) {
      if (!Array.isArray(cls.students) || cls.students.length > 120) {
        return {
          ok: false,
          error: `Lista de estudantes da turma "${idCheck.data}" inv\xE1lida ou excede 120 alunos.`
        };
      }
      for (let sIdx = 0; sIdx < cls.students.length; sIdx++) {
        const st = cls.students[sIdx];
        if (!isPlainObject(st)) {
          return {
            ok: false,
            error: `Registro de estudante inv\xE1lido na turma "${idCheck.data}".`
          };
        }
        if (st.totalAbsencesMonth !== void 0) {
          const absCheck = requireFiniteNonNegativeNumber(
            st.totalAbsencesMonth,
            `totalAbsencesMonth`,
            31
          );
          if (!absCheck.ok) return absCheck;
        }
        if (st.justifiedAbsences !== void 0) {
          const justCheck = requireFiniteNonNegativeNumber(
            st.justifiedAbsences,
            `justifiedAbsences`,
            31
          );
          if (!justCheck.ok) return justCheck;
        }
      }
    }
  }
  if (classesUpdatedAtMs !== void 0) {
    const tsCheck = requireFiniteNonNegativeNumber(classesUpdatedAtMs, "classesUpdatedAtMs");
    if (!tsCheck.ok) return tsCheck;
  }
  if (discoveredNominalPdfs !== void 0 && (!Array.isArray(discoveredNominalPdfs) || discoveredNominalPdfs.length > 5e3)) {
    return { ok: false, error: "discoveredNominalPdfs deve ser um array com at\xE9 5000 itens." };
  }
  if (discoveredDrivePhotos !== void 0 && (!Array.isArray(discoveredDrivePhotos) || discoveredDrivePhotos.length > 5e3)) {
    return { ok: false, error: "discoveredDrivePhotos deve ser um array com at\xE9 5000 itens." };
  }
  if (cloudLinks !== void 0 && !isPlainObject(cloudLinks)) {
    return { ok: false, error: "cloudLinks deve ser um objeto v\xE1lido." };
  }
  const opIdCheck = optionalTrimmedString(opId, "opId", 128);
  if (!opIdCheck.ok) return opIdCheck;
  return {
    ok: true,
    data: {
      classes,
      classesUpdatedAtMs,
      discoveredNominalPdfs,
      discoveredDrivePhotos,
      cloudLinks,
      opId: opIdCheck.data
    }
  };
};
var validateSchoolStateLinksPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const { cloudLinks, discoveredNominalPdfs, discoveredDrivePhotos, genderDictionary } = base.data;
  if (cloudLinks === void 0 && discoveredNominalPdfs === void 0 && discoveredDrivePhotos === void 0 && genderDictionary === void 0) {
    return { ok: false, error: "Nenhum par\xE2metro de v\xEDnculo informado para atualiza\xE7\xE3o." };
  }
  if (cloudLinks !== void 0 && !isPlainObject(cloudLinks)) {
    return { ok: false, error: "cloudLinks inv\xE1lido." };
  }
  if (discoveredNominalPdfs !== void 0 && (!Array.isArray(discoveredNominalPdfs) || discoveredNominalPdfs.length > 5e3)) {
    return { ok: false, error: "discoveredNominalPdfs inv\xE1lido ou acima de 5000 itens." };
  }
  if (discoveredDrivePhotos !== void 0 && (!Array.isArray(discoveredDrivePhotos) || discoveredDrivePhotos.length > 5e3)) {
    return { ok: false, error: "discoveredDrivePhotos inv\xE1lido ou acima de 5000 itens." };
  }
  let normalizedGenderDict;
  if (genderDictionary !== void 0) {
    if (!Array.isArray(genderDictionary) || genderDictionary.length > 5e3) {
      return { ok: false, error: "genderDictionary inv\xE1lido ou acima de 5000 itens." };
    }
    normalizedGenderDict = [];
    for (let i = 0; i < genderDictionary.length; i++) {
      const entry = genderDictionary[i];
      if (!isPlainObject(entry)) {
        return { ok: false, error: `genderDictionary[${i}] inv\xE1lido.` };
      }
      const nameCheck = requireTrimmedString(entry.name, `genderDictionary[${i}].name`, 160);
      if (!nameCheck.ok) return nameCheck;
      const g = String(entry.gender || "").trim().toUpperCase();
      if (g !== "M" && g !== "F") {
        return { ok: false, error: `genderDictionary[${i}].gender deve ser M ou F.` };
      }
      const hintCheck = optionalTrimmedString(entry.relationshipHint, `genderDictionary[${i}].relationshipHint`, 80);
      if (!hintCheck.ok) return hintCheck;
      normalizedGenderDict.push({
        name: nameCheck.data,
        gender: g,
        ...hintCheck.data ? { relationshipHint: hintCheck.data } : {}
      });
    }
  }
  return {
    ok: true,
    data: {
      cloudLinks,
      discoveredNominalPdfs,
      discoveredDrivePhotos,
      genderDictionary: normalizedGenderDict
    }
  };
};
var VALID_USER_ROLES = /* @__PURE__ */ new Set(["admin", "usuario", "peb2"]);
var validateSchoolStateUsersPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const { authorizedUsers } = base.data;
  if (!Array.isArray(authorizedUsers)) {
    return { ok: false, error: "Lista de authorizedUsers inv\xE1lida." };
  }
  if (authorizedUsers.length > 500) {
    return { ok: false, error: "authorizedUsers excede o limite de 500 usu\xE1rios." };
  }
  for (let i = 0; i < authorizedUsers.length; i++) {
    const u = authorizedUsers[i];
    if (!isPlainObject(u)) {
      return { ok: false, error: `Usu\xE1rio na posi\xE7\xE3o ${i} inv\xE1lido.` };
    }
    const emailCheck = requireTrimmedString(u.email, `authorizedUsers[${i}].email`, 254);
    if (!emailCheck.ok) return emailCheck;
    if (!isInstitutionalEmailAddress(emailCheck.data)) {
      return {
        ok: false,
        error: `E-mail n\xE3o institucional rejeitado em authorizedUsers[${i}]: "${emailCheck.data}".`
      };
    }
    if (u.role !== void 0 && !VALID_USER_ROLES.has(String(u.role))) {
      return { ok: false, error: `Perfil inv\xE1lido em authorizedUsers[${i}].role.` };
    }
    if (u.accessExpiresAt !== void 0 && u.accessExpiresAt !== null && u.accessExpiresAt !== "") {
      if (typeof u.accessExpiresAt !== "string" || !isValidIsoCalendarDate(u.accessExpiresAt)) {
        return {
          ok: false,
          error: `Data de expira\xE7\xE3o inv\xE1lida em authorizedUsers[${i}].accessExpiresAt (use YYYY-MM-DD real).`
        };
      }
    }
  }
  return { ok: true, data: { authorizedUsers } };
};
var validateSchoolStateResetPayload = (body) => {
  if (body === void 0 || body === null) {
    return { ok: true, data: {} };
  }
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const { freshClasses } = base.data;
  if (freshClasses !== void 0) {
    if (!Array.isArray(freshClasses) || freshClasses.length > 80) {
      return { ok: false, error: "freshClasses deve ser um array com no m\xE1ximo 80 turmas." };
    }
  }
  return { ok: true, data: { freshClasses } };
};
var validateSchoolStateImportJsonPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const { payload, fileName, fileSize } = base.data;
  if (!payload || typeof payload !== "object" && !Array.isArray(payload)) {
    return { ok: false, error: "Conte\xFAdo JSON n\xE3o fornecido ou vazio." };
  }
  let rawClasses = null;
  if (Array.isArray(payload)) {
    rawClasses = payload;
  } else if (isPlainObject(payload)) {
    if (Array.isArray(payload.classes)) rawClasses = payload.classes;
    else if (Array.isArray(payload.turmas)) rawClasses = payload.turmas;
  }
  if (!rawClasses || rawClasses.length === 0 || rawClasses.length > 80) {
    return {
      ok: false,
      error: 'Estrutura JSON inv\xE1lida. O arquivo precisa conter entre 1 e 80 turmas em "classes" ou "turmas".'
    };
  }
  const fn = optionalTrimmedString(fileName, "fileName", 255);
  if (!fn.ok) return fn;
  return {
    ok: true,
    data: {
      payload,
      fileName: fn.data,
      fileSize
    }
  };
};
var validateSchoolStateLogsPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const { accessSessionLogs, authorizedUsers } = base.data;
  if (accessSessionLogs !== void 0) {
    if (!Array.isArray(accessSessionLogs) || accessSessionLogs.length > 600) {
      return { ok: false, error: "accessSessionLogs deve conter no m\xE1ximo 600 registros." };
    }
    for (let i = 0; i < accessSessionLogs.length; i++) {
      const l = accessSessionLogs[i];
      if (!isPlainObject(l) || typeof l.id !== "string" || !l.id.trim()) {
        return { ok: false, error: `Registro de sess\xE3o #${i + 1} sem id v\xE1lido.` };
      }
    }
  }
  if (authorizedUsers !== void 0) {
    if (!Array.isArray(authorizedUsers) || authorizedUsers.length > 500) {
      return { ok: false, error: "authorizedUsers excede o limite de 500 usu\xE1rios." };
    }
  }
  return { ok: true, data: { accessSessionLogs, authorizedUsers } };
};
var validateAttendanceWindowPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const cfg = base.data.attendanceWindowConfig;
  if (!isPlainObject(cfg)) {
    return { ok: false, error: "Configura\xE7\xE3o de janela de chamada inv\xE1lida." };
  }
  if (typeof cfg.exceptionalOverrideOpen !== "boolean" && typeof cfg.isOpen !== "boolean") {
    return {
      ok: false,
      error: "attendanceWindowConfig.exceptionalOverrideOpen deve ser booleano."
    };
  }
  if (cfg.simulatedDateISO !== void 0 && cfg.simulatedDateISO !== null && cfg.simulatedDateISO !== "") {
    if (typeof cfg.simulatedDateISO !== "string" || !isValidIsoCalendarDate(cfg.simulatedDateISO)) {
      return {
        ok: false,
        error: "simulatedDateISO inv\xE1lido. Informe uma data real no formato YYYY-MM-DD."
      };
    }
  }
  if (cfg.closeDateISO !== void 0 && cfg.closeDateISO !== null && cfg.closeDateISO !== "") {
    if (typeof cfg.closeDateISO !== "string" || !isValidIsoCalendarDate(cfg.closeDateISO)) {
      return {
        ok: false,
        error: "closeDateISO inv\xE1lido. Informe uma data real no formato YYYY-MM-DD."
      };
    }
  }
  return { ok: true, data: { attendanceWindowConfig: cfg } };
};
var validateSchoolNoticesPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const { schoolNotices } = base.data;
  if (!Array.isArray(schoolNotices) || schoolNotices.length > 100) {
    return { ok: false, error: "Lista de avisos inv\xE1lida ou excede 100 comunicados." };
  }
  for (let i = 0; i < schoolNotices.length; i++) {
    const n = schoolNotices[i];
    if (!isPlainObject(n)) {
      return { ok: false, error: `Comunicado #${i + 1} malformado.` };
    }
    const idCheck = requireTrimmedString(n.id, `schoolNotices[${i}].id`, 128);
    if (!idCheck.ok) return idCheck;
    const titleCheck = requireTrimmedString(n.title, `schoolNotices[${i}].title`, 220);
    if (!titleCheck.ok) return titleCheck;
    const contentCheck = requireTrimmedString(n.content, `schoolNotices[${i}].content`, 4e3);
    if (!contentCheck.ok) return contentCheck;
  }
  return { ok: true, data: { schoolNotices } };
};
var validateCalendarConfigPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const { rawDatesText, schoolDays, adminEmail, adminName, year = 2027 } = base.data;
  const hasRaw = typeof rawDatesText === "string" && rawDatesText.trim().length > 0;
  const hasArray = Array.isArray(schoolDays) && schoolDays.length > 0;
  if (!hasRaw && !hasArray) {
    return {
      ok: false,
      error: "Informe rawDatesText ou schoolDays com as 200 datas letivas."
    };
  }
  if (hasRaw && rawDatesText.length > 64e3) {
    return { ok: false, error: "rawDatesText excede o limite de tamanho permitido." };
  }
  if (Array.isArray(schoolDays) && schoolDays.length > 400) {
    return { ok: false, error: "schoolDays excede o m\xE1ximo de 400 itens." };
  }
  const parsedYear = Number(year);
  if (!Number.isInteger(parsedYear) || parsedYear < 2020 || parsedYear > 2035) {
    return { ok: false, error: "Ano letivo inv\xE1lido (permitido entre 2020 e 2035)." };
  }
  const emailCheck = optionalTrimmedString(adminEmail, "adminEmail", 254);
  if (!emailCheck.ok) return emailCheck;
  if (emailCheck.data && !isValidEmailFormat(emailCheck.data)) {
    return { ok: false, error: "adminEmail inv\xE1lido." };
  }
  const nameCheck = optionalTrimmedString(adminName, "adminName", 160);
  if (!nameCheck.ok) return nameCheck;
  return {
    ok: true,
    data: {
      rawDatesText: typeof rawDatesText === "string" ? rawDatesText : void 0,
      schoolDays: Array.isArray(schoolDays) ? schoolDays : void 0,
      adminEmail: emailCheck.data,
      adminName: nameCheck.data,
      year: parsedYear
    }
  };
};
var VALID_HOLIDAY_TYPES = /* @__PURE__ */ new Set([
  "nacional",
  "estadual",
  "municipal",
  "recesso",
  "ponto_facultativo"
]);
var validateHolidayActionPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const { action, holiday, holidayId, adminEmail, adminName } = base.data;
  if (action !== "add" && action !== "edit" && action !== "delete" && action !== "restore_defaults") {
    return { ok: false, error: "A\xE7\xE3o de feriado inv\xE1lida." };
  }
  if (action === "delete") {
    const idCheck = requireTrimmedString(holidayId, "holidayId", 128);
    if (!idCheck.ok) return idCheck;
  } else if (action === "add" || action === "edit") {
    if (!isPlainObject(holiday)) {
      return { ok: false, error: "Objeto holiday inv\xE1lido." };
    }
    if (action === "edit") {
      const holId = requireTrimmedString(holiday.id, "holiday.id", 128);
      if (!holId.ok) return holId;
    }
    const dateCheck = requireTrimmedString(holiday.date, "holiday.date", 20);
    if (!dateCheck.ok) return dateCheck;
    if (!isValidBrCalendarDate(dateCheck.data)) {
      return {
        ok: false,
        error: "Data do feriado inv\xE1lida. Informe uma data real no formato DD/MM/AAAA."
      };
    }
    const nameCheck = requireTrimmedString(holiday.name, "holiday.name", 160);
    if (!nameCheck.ok) return nameCheck;
    if (holiday.type !== void 0 && !VALID_HOLIDAY_TYPES.has(String(holiday.type))) {
      return { ok: false, error: "Tipo de feriado inv\xE1lido." };
    }
  }
  return {
    ok: true,
    data: {
      action,
      holiday,
      holidayId: typeof holidayId === "string" ? holidayId.trim() : void 0,
      adminEmail: typeof adminEmail === "string" ? adminEmail.trim() : void 0,
      adminName: typeof adminName === "string" ? adminName.trim() : void 0
    }
  };
};
var validateSecurityLogPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const eventTypeCheck = requireTrimmedString(base.data.eventType, "eventType", 100);
  if (!eventTypeCheck.ok) return eventTypeCheck;
  const detailsCheck = optionalTrimmedString(base.data.details, "details", 2e3);
  if (!detailsCheck.ok) return detailsCheck;
  const titleCheck = optionalTrimmedString(base.data.actionTitle, "actionTitle", 200);
  if (!titleCheck.ok) return titleCheck;
  return { ok: true, data: base.data };
};
var validateFcmRegisterTokenPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const idCheck = requireTrimmedString(base.data.id, "id", 128);
  if (!idCheck.ok) return idCheck;
  const emailCheck = requireTrimmedString(base.data.userEmail, "userEmail", 254);
  if (!emailCheck.ok) return emailCheck;
  if (!isInstitutionalEmailAddress(emailCheck.data)) {
    return { ok: false, error: "userEmail deve pertencer ao dom\xEDnio institucional oficial." };
  }
  if (base.data.assignedClassIds !== void 0) {
    if (!Array.isArray(base.data.assignedClassIds) || base.data.assignedClassIds.length > 60) {
      return { ok: false, error: "assignedClassIds inv\xE1lido ou excede 60 turmas." };
    }
  }
  if (base.data.pushSubscription !== void 0) {
    const sub = base.data.pushSubscription;
    if (!isPlainObject(sub) || typeof sub.endpoint !== "string" || !sub.endpoint.startsWith("https://") || !isPlainObject(sub.keys) || typeof sub.keys.p256dh !== "string" || typeof sub.keys.auth !== "string") {
      return { ok: false, error: "pushSubscription Web Push inv\xE1lida." };
    }
  }
  return { ok: true, data: base.data };
};
var validateFcmUnregisterTokenPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const idCheck = optionalTrimmedString(base.data.id, "id", 128);
  if (!idCheck.ok) return idCheck;
  const emailCheck = optionalTrimmedString(base.data.userEmail, "userEmail", 254);
  if (!emailCheck.ok) return emailCheck;
  if (emailCheck.data && !isValidEmailFormat(emailCheck.data)) {
    return { ok: false, error: "userEmail inv\xE1lido." };
  }
  return { ok: true, data: { id: idCheck.data, userEmail: emailCheck.data } };
};
var validateFcmConfigPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const cfg = base.data.fcmConfig;
  if (!isPlainObject(cfg)) {
    return { ok: false, error: "Configura\xE7\xE3o FCM inv\xE1lida." };
  }
  if (cfg.notifyDaysBeforeClose !== void 0) {
    const daysCheck = requireFiniteNonNegativeNumber(
      cfg.notifyDaysBeforeClose,
      "notifyDaysBeforeClose",
      15
    );
    if (!daysCheck.ok || daysCheck.data < 1) {
      return {
        ok: false,
        error: "notifyDaysBeforeClose deve ser um n\xFAmero entre 1 e 15."
      };
    }
  }
  const vapidCheck = optionalTrimmedString(cfg.vapidPublicKey, "vapidPublicKey", 256);
  if (!vapidCheck.ok) return vapidCheck;
  return { ok: true, data: { fcmConfig: cfg } };
};
var validateFcmSendWindowAlertPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const alert = base.data.alert;
  if (!isPlainObject(alert)) {
    return { ok: false, error: "Payload do alerta Push inv\xE1lido." };
  }
  const titleCheck = requireTrimmedString(alert.title, "alert.title", 180);
  if (!titleCheck.ok) return titleCheck;
  const bodyCheck = requireTrimmedString(alert.body, "alert.body", 600);
  if (!bodyCheck.ok) return bodyCheck;
  if (alert.targetClassIds !== void 0) {
    if (!Array.isArray(alert.targetClassIds) || alert.targetClassIds.length > 80) {
      return { ok: false, error: "alert.targetClassIds inv\xE1lido ou excede 80 turmas." };
    }
  }
  return { ok: true, data: { alert } };
};
var validateLgpdConfigPayload = (body) => {
  const base = ensureSafePayloadObject(body);
  if (!base.ok) return base;
  const cfg = isPlainObject(base.data.lgpdConfig) ? base.data.lgpdConfig : base.data;
  if (!isPlainObject(cfg)) {
    return { ok: false, error: "Configura\xE7\xE3o LGPD inv\xE1lida." };
  }
  const maskSensitiveDataByDefault = typeof cfg.maskSensitiveDataByDefault === "boolean" ? cfg.maskSensitiveDataByDefault : true;
  const requireMfaForAdmin = typeof cfg.requireMfaForAdmin === "boolean" ? cfg.requireMfaForAdmin : true;
  const anonymizeExportedSpreadsheets = typeof cfg.anonymizeExportedSpreadsheets === "boolean" ? cfg.anonymizeExportedSpreadsheets : true;
  const retentionCheck = cfg.dataRetentionDays !== void 0 ? requireFiniteNonNegativeNumber(cfg.dataRetentionDays, "dataRetentionDays", 3650) : { ok: true, data: 1825 };
  if (!retentionCheck.ok) return retentionCheck;
  const autoLogoutCheck = cfg.autoLogoutMinutes !== void 0 ? requireFiniteNonNegativeNumber(cfg.autoLogoutMinutes, "autoLogoutMinutes", 240) : { ok: true, data: 60 };
  if (!autoLogoutCheck.ok) return autoLogoutCheck;
  const autoLogoutMinutes = Math.max(5, Math.round(autoLogoutCheck.data || 60));
  const dpoCheck = optionalTrimmedString(cfg.complianceOfficer, "complianceOfficer", 180);
  if (!dpoCheck.ok) return dpoCheck;
  return {
    ok: true,
    data: {
      lgpdConfig: {
        maskSensitiveDataByDefault,
        requireMfaForAdmin,
        anonymizeExportedSpreadsheets,
        dataRetentionDays: Math.max(30, Math.round(retentionCheck.data || 1825)),
        autoLogoutMinutes,
        complianceOfficer: dpoCheck.data || "Encarregado de Dados DPO / EMEB Candel\xE1rio",
        lastAuditedAtISO: (/* @__PURE__ */ new Date()).toISOString()
      }
    }
  };
};

// server.ts
var MONTH_NAMES_PT = [
  "Janeiro",
  "Fevereiro",
  "Mar\xE7o",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];
var DAYS_OF_WEEK_PT = [
  "Domingo",
  "Segunda-feira",
  "Ter\xE7a-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "S\xE1bado"
];
var OFFICIAL_DEFAULT_HOLIDAYS_2027 = [
  { id: "hol-01", date: "01/01/2027", name: "Confraterniza\xE7\xE3o Universal", type: "nacional", isOfficial: true },
  { id: "hol-02", date: "08/02/2027", name: "Carnaval (Recesso Escolar)", type: "recesso", isOfficial: true },
  { id: "hol-03", date: "09/02/2027", name: "Ter\xE7a-feira de Carnaval", type: "ponto_facultativo", isOfficial: true },
  { id: "hol-04", date: "10/02/2027", name: "Quarta-feira de Cinzas", type: "ponto_facultativo", isOfficial: true },
  { id: "hol-05", date: "26/03/2027", name: "Sexta-feira Santa (Paix\xE3o de Cristo)", type: "nacional", isOfficial: true },
  { id: "hol-06", date: "21/04/2027", name: "Tiradentes", type: "nacional", isOfficial: true },
  { id: "hol-07", date: "01/05/2027", name: "Dia Mundial do Trabalho", type: "nacional", isOfficial: true },
  { id: "hol-08", date: "27/05/2027", name: "Corpus Christi", type: "municipal", isOfficial: true },
  { id: "hol-09", date: "28/05/2027", name: "Emenda Corpus Christi (Ponto Facultativo)", type: "ponto_facultativo", isOfficial: true },
  { id: "hol-10", date: "09/07/2027", name: "Revolu\xE7\xE3o Constitucionalista de 1932", type: "estadual", isOfficial: true },
  { id: "hol-11", date: "15/08/2027", name: "Nossa Senhora do Desterro (Padroeira de Jundia\xED)", type: "municipal", isOfficial: true },
  { id: "hol-12", date: "07/09/2027", name: "Independ\xEAncia do Brasil", type: "nacional", isOfficial: true },
  { id: "hol-13", date: "12/10/2027", name: "Nossa Senhora Aparecida / Dia das Crian\xE7as", type: "nacional", isOfficial: true },
  { id: "hol-14", date: "15/10/2027", name: "Dia do Professor (Recesso Escolar SME)", type: "recesso", isOfficial: true },
  { id: "hol-15", date: "28/10/2027", name: "Dia do Servidor P\xFAblico", type: "ponto_facultativo", isOfficial: true },
  { id: "hol-16", date: "02/11/2027", name: "Finados", type: "nacional", isOfficial: true },
  { id: "hol-17", date: "15/11/2027", name: "Proclama\xE7\xE3o da Rep\xFAblica", type: "nacional", isOfficial: true },
  { id: "hol-18", date: "20/11/2027", name: "Dia da Consci\xEAncia Negra", type: "nacional", isOfficial: true },
  { id: "hol-19", date: "14/12/2027", name: "Anivers\xE1rio de Jundia\xED (371 anos)", type: "municipal", isOfficial: true },
  { id: "hol-20", date: "25/12/2027", name: "Natal", type: "nacional", isOfficial: true }
];
var generateOfficial200SchoolDays2027 = (holidays = OFFICIAL_DEFAULT_HOLIDAYS_2027) => {
  const holidayDateSet = new Set(holidays.map((h) => h && h.date ? h.date.trim() : ""));
  const schoolDays = [];
  const targets = {
    2: 16,
    3: 22,
    4: 20,
    5: 20,
    6: 20,
    7: 10,
    8: 22,
    9: 20,
    10: 20,
    11: 18,
    12: 12
  };
  const pad = (n) => n.toString().padStart(2, "0");
  for (let month = 2; month <= 12; month++) {
    const targetCount = targets[month] || 20;
    let addedForMonth = 0;
    const daysInMonth = new Date(2027, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      if (addedForMonth >= targetCount) break;
      if (month === 7 && day < 19) continue;
      const dateObj = new Date(2027, month - 1, day);
      const dayOfWeek = dateObj.getDay();
      const dateStr = `${pad(day)}/${pad(month)}/2027`;
      if (dayOfWeek >= 1 && dayOfWeek <= 5 && !holidayDateSet.has(dateStr)) {
        schoolDays.push(dateStr);
        addedForMonth++;
      }
    }
    if (addedForMonth < targetCount) {
      for (let day = 1; day <= daysInMonth; day++) {
        if (addedForMonth >= targetCount) break;
        const dateObj = new Date(2027, month - 1, day);
        const dayOfWeek = dateObj.getDay();
        const dateStr = `${pad(day)}/${pad(month)}/2027`;
        if (dayOfWeek === 6 && !holidayDateSet.has(dateStr) && !schoolDays.includes(dateStr)) {
          schoolDays.push(dateStr);
          addedForMonth++;
        }
      }
    }
  }
  return schoolDays.sort((a, b) => {
    const [da, ma, ya] = a.split("/").map(Number);
    const [db, mb, yb] = b.split("/").map(Number);
    return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
  });
};
var parseAndValidateSchoolDates = (rawText, holidays = OFFICIAL_DEFAULT_HOLIDAYS_2027) => {
  if (!rawText || !rawText.trim()) {
    return {
      validDates: [],
      calendarDays: [],
      monthlyDistribution: {},
      totalCount: 0,
      remainingCount: 200,
      exceededCount: 0,
      isExactly200: false,
      hasErrors: true,
      duplicateEntries: [],
      invalidEntries: [{ line: 1, raw: "", reason: "Nenhuma data informada. Cole as datas uma por linha." }],
      holidayConflicts: [],
      weekendDays: []
    };
  }
  const holidayMap = /* @__PURE__ */ new Map();
  holidays.forEach((h) => {
    const cleanDate = h && h.date ? h.date.trim() : "";
    if (cleanDate) holidayMap.set(cleanDate, h);
  });
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const seenOccurrences = /* @__PURE__ */ new Map();
  const validDatesSet = /* @__PURE__ */ new Set();
  const invalidEntries = [];
  const weekendDays = [];
  const holidayConflicts = [];
  const dateRegex = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/;
  let lineCounter = 1;
  for (const rawLine of lines) {
    const tokens = rawLine.split(/[\s,;]+/).filter((t) => t.trim().length > 0);
    for (const token of tokens) {
      const match = token.match(dateRegex);
      if (!match) {
        invalidEntries.push({ line: lineCounter, raw: token, reason: "Formato inv\xE1lido. Use DD/MM/AAAA." });
        continue;
      }
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      if (month < 1 || month > 12) {
        invalidEntries.push({ line: lineCounter, raw: token, reason: `M\xEAs inv\xE1lido (${month}).` });
        continue;
      }
      if (year < 2020 || year > 2035) {
        invalidEntries.push({ line: lineCounter, raw: token, reason: `Ano fora da faixa permitida (${year}).` });
        continue;
      }
      const daysInTargetMonth = new Date(year, month, 0).getDate();
      if (day < 1 || day > daysInTargetMonth) {
        invalidEntries.push({ line: lineCounter, raw: token, reason: `Dia inv\xE1lido para o m\xEAs ${month}/${year}.` });
        continue;
      }
      const normalizedDate = `${day.toString().padStart(2, "0")}/${month.toString().padStart(2, "0")}/${year}`;
      const count = (seenOccurrences.get(normalizedDate) || 0) + 1;
      seenOccurrences.set(normalizedDate, count);
      if (count === 1) {
        validDatesSet.add(normalizedDate);
        const dateObj = new Date(year, month - 1, day);
        const dayOfWeekIndex = dateObj.getDay();
        const dayOfWeekName = DAYS_OF_WEEK_PT[dayOfWeekIndex];
        if (dayOfWeekIndex === 0 || dayOfWeekIndex === 6) {
          weekendDays.push({
            date: normalizedDate,
            dayOfWeek: dayOfWeekName,
            isSaturday: dayOfWeekIndex === 6
          });
        }
        if (holidayMap.has(normalizedDate)) {
          const hol = holidayMap.get(normalizedDate);
          holidayConflicts.push({
            date: normalizedDate,
            holidayName: hol.name,
            holidayType: hol.type
          });
        }
      }
    }
    lineCounter++;
  }
  const duplicateEntries = [];
  seenOccurrences.forEach((count, date) => {
    if (count > 1) duplicateEntries.push({ date, occurrences: count });
  });
  const sortedDates = Array.from(validDatesSet).sort((a, b) => {
    const [da, ma, ya] = a.split("/").map(Number);
    const [db, mb, yb] = b.split("/").map(Number);
    return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
  });
  const monthlyDistribution = {};
  MONTH_NAMES_PT.forEach((m) => {
    monthlyDistribution[m] = 0;
  });
  const calendarDays = sortedDates.map((dateStr, idx) => {
    const [d, m, y] = dateStr.split("/").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeekIndex = dateObj.getDay();
    const monthName = MONTH_NAMES_PT[m - 1] || "Outro";
    monthlyDistribution[monthName] = (monthlyDistribution[monthName] || 0) + 1;
    const isSat = dayOfWeekIndex === 6;
    const isSun = dayOfWeekIndex === 0;
    const conflict = holidayMap.get(dateStr);
    let type = "dia_letivo";
    if (isSat) type = "sabado_letivo";
    else if (conflict) type = conflict.type === "recesso" ? "recesso" : "feriado";
    return {
      id: `cal-day-${idx + 1}`,
      date: dateStr,
      isoDate: `${y}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`,
      dayOfWeek: DAYS_OF_WEEK_PT[dayOfWeekIndex],
      dayNumber: d,
      month: monthName,
      monthNumber: m,
      year: y,
      isSaturday: isSat,
      isSunday: isSun,
      holidayConflict: conflict ? `${conflict.name} (${conflict.type})` : void 0,
      type,
      description: conflict ? conflict.name : isSat ? "S\xE1bado Letivo Tem\xE1tico" : "Dia Letivo Regular"
    };
  });
  const totalCount = sortedDates.length;
  return {
    validDates: sortedDates,
    calendarDays,
    monthlyDistribution,
    totalCount,
    remainingCount: Math.max(0, 200 - totalCount),
    exceededCount: Math.max(0, totalCount - 200),
    isExactly200: totalCount === 200,
    hasErrors: invalidEntries.length > 0 || duplicateEntries.length > 0,
    duplicateEntries,
    invalidEntries,
    holidayConflicts,
    weekendDays
  };
};
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var DEFAULT_PERSISTENT_DIR = path.join(__dirname, ".emeb_data");
var resolveWritableDataDir = () => {
  const candidates = [
    process.env.EMEB_DATA_DIR?.trim(),
    DEFAULT_PERSISTENT_DIR,
    os.tmpdir()
  ].filter((d) => Boolean(d));
  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
    }
  }
  return os.tmpdir();
};
var DATA_DIR = resolveWritableDataDir();
var STATE_FILE_NAME = "emeb_candelario_shared_school_state_2027_v2.json";
var SECRETS_FILE_NAME = "emeb_candelario_server_secrets_v1.json";
var STATE_FILE_PATH = path.join(DATA_DIR, STATE_FILE_NAME);
var SECRETS_FILE_PATH = path.join(DATA_DIR, SECRETS_FILE_NAME);
var TMP_STATE_FILE_PATH = path.join(os.tmpdir(), STATE_FILE_NAME);
var TMP_SECRETS_FILE_PATH = path.join(os.tmpdir(), SECRETS_FILE_NAME);
var LEGACY_STATE_FILE_PATH = path.join(__dirname, "shared_school_state_2027_v2.json");
var SERVER_CLEAN_RESET_EPOCH_ID = "clean_zero_data_2026_11_16_v1";
var deduplicateUsersByEmail = (users) => {
  if (!Array.isArray(users)) return users;
  const map = /* @__PURE__ */ new Map();
  users.forEach((u, idx) => {
    if (!u || typeof u.email !== "string") return;
    const email = u.email.trim().toLowerCase();
    if (!email) return;
    const existing = map.get(email);
    if (!existing) {
      map.set(email, { ...u, id: u.id || `usr-official-${idx}`, email });
    } else {
      const incTime = u.updatedAtMs || 0;
      const extTime = existing.updatedAtMs || 0;
      const winner = incTime >= extTime ? u : existing;
      map.set(email, {
        ...winner,
        email,
        updatedAtMs: Math.max(incTime, extTime),
        totalAccessCount: Math.max(u.totalAccessCount || 0, existing.totalAccessCount || 0),
        totalDurationSeconds: Math.max(
          u.totalDurationSeconds || 0,
          existing.totalDurationSeconds || 0
        ),
        lastSessionDurationSeconds: Math.max(
          u.lastSessionDurationSeconds || 0,
          existing.lastSessionDurationSeconds || 0
        ),
        lastLoginAt: u.lastLoginAt || existing.lastLoginAt,
        lastActiveAt: u.lastActiveAt || existing.lastActiveAt,
        lastScreenVisited: u.lastScreenVisited || existing.lastScreenVisited
      });
    }
  });
  return Array.from(map.values());
};
var sanitizeAndDeduplicateClasses = (classes) => {
  if (!Array.isArray(classes)) return classes;
  return classes.map((cls, clsIdx) => {
    const cleanClassId = cls?.id || `cls-${clsIdx + 1}`;
    const rawStudents = Array.isArray(cls?.students) ? cls.students : [];
    const seenKeys = /* @__PURE__ */ new Set();
    const seenIds = /* @__PURE__ */ new Set();
    const cleanStudents = [];
    rawStudents.forEach((st, idx) => {
      if (!st || typeof st !== "object") return;
      const resolvedName = String(st.name || st.estudante || st.ESTUDANTE || st.nome || "").trim();
      if (!resolvedName) return;
      const normName = resolvedName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
      const raKey = String(st.ra || st.RA || "").trim();
      const dedupKey = raKey ? `ra:${raKey}|name:${normName}` : `name:${normName}`;
      if (seenKeys.has(dedupKey)) return;
      seenKeys.add(dedupKey);
      const num = st.number || idx + 1;
      let studentId = st.id || `${cleanClassId}-s${num}`;
      if (seenIds.has(studentId)) {
        studentId = `${cleanClassId}-s${num}-i${idx + 1}`;
      }
      seenIds.add(studentId);
      cleanStudents.push({
        ...st,
        id: studentId,
        name: resolvedName,
        number: num
      });
    });
    return {
      ...cls,
      id: cleanClassId,
      totalStudents: cleanStudents.length,
      students: cleanStudents
    };
  });
};
var cachedSharedState = null;
var cachedServerSecrets = null;
var pendingStateFlushDirty = false;
var stateFlushInProgress = null;
var secretsFlushChain = Promise.resolve();
var readServerSecrets = () => {
  if (cachedServerSecrets) return cachedServerSecrets;
  try {
    const secretsFile = fs.existsSync(SECRETS_FILE_PATH) ? SECRETS_FILE_PATH : fs.existsSync(TMP_SECRETS_FILE_PATH) ? TMP_SECRETS_FILE_PATH : null;
    if (secretsFile) {
      const raw = fs.readFileSync(secretsFile, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const resolvedSecrets = parsed;
        cachedServerSecrets = resolvedSecrets;
        return resolvedSecrets;
      }
    }
  } catch (err) {
    console.warn("Erro ao ler segredos locais do servidor:", err);
  }
  const emptySecrets = {};
  cachedServerSecrets = emptySecrets;
  return emptySecrets;
};
var writeServerSecrets = (patch) => {
  const current = readServerSecrets();
  const next = { ...current, ...patch };
  cachedServerSecrets = next;
  const serialized = JSON.stringify(next);
  secretsFlushChain = secretsFlushChain.then(async () => {
    const tmpPath = `${SECRETS_FILE_PATH}.tmp`;
    await fs.promises.writeFile(tmpPath, serialized, { encoding: "utf-8", mode: 384 });
    await fs.promises.rename(tmpPath, SECRETS_FILE_PATH);
    try {
      await fs.promises.chmod(SECRETS_FILE_PATH, 384);
    } catch {
    }
  }).catch((err) => {
    console.warn("Erro ao persistir segredos locais do servidor:", err);
  });
  return next;
};
var flushSharedStateToDiskAsync = async () => {
  if (stateFlushInProgress) return stateFlushInProgress;
  stateFlushInProgress = (async () => {
    while (pendingStateFlushDirty && cachedSharedState) {
      pendingStateFlushDirty = false;
      const snapshotJson = JSON.stringify(cachedSharedState);
      const tmpPath = `${STATE_FILE_PATH}.tmp`;
      const bakPath = `${STATE_FILE_PATH}.bak`;
      try {
        await fs.promises.writeFile(tmpPath, snapshotJson, "utf-8");
        await fs.promises.rename(tmpPath, STATE_FILE_PATH);
        try {
          await fs.promises.copyFile(STATE_FILE_PATH, bakPath);
        } catch {
        }
      } catch (err) {
        console.warn("Erro ao gravar shared_school_state_2027.json:", err);
      }
    }
  })().finally(() => {
    stateFlushInProgress = null;
  });
  return stateFlushInProgress;
};
var buildDefaultSharedState = () => {
  const defaultHols = OFFICIAL_DEFAULT_HOLIDAYS_2027;
  const defaultDays = generateOfficial200SchoolDays2027(defaultHols);
  const validation = parseAndValidateSchoolDates(defaultDays.join("\n"), defaultHols);
  return {
    cleanResetEpochId: SERVER_CLEAN_RESET_EPOCH_ID,
    authorizedUsers: deduplicateUsersByEmail(INITIAL_AUTHORIZED_USERS),
    updatedAtMs: Date.now(),
    holidays: defaultHols,
    officialCalendarConfig: {
      year: 2027,
      schoolDays: defaultDays,
      calendarDays: validation.calendarDays,
      monthlyDistribution: validation.monthlyDistribution,
      holidays: defaultHols,
      updatedAtMs: Date.now(),
      updatedByEmail: "emebjfreitas@jundiai.sp.gov.br",
      updatedByName: "Administrador EMEB Joaquim Candel\xE1rio de Freitas",
      version: 1
    },
    calendarAuditLogs: [
      {
        id: "audit-init-2027",
        timestampISO: (/* @__PURE__ */ new Date()).toISOString(),
        adminEmail: "emebjfreitas@jundiai.sp.gov.br",
        adminName: "Sistema SME Jundia\xED",
        action: "RESTORE_DEFAULT",
        previousDaysCount: 0,
        newDaysCount: 200,
        holidaysCount: defaultHols.length,
        details: "Inicializa\xE7\xE3o oficial da matriz centralizada de 200 dias letivos (2027)."
      }
    ]
  };
};
var readSharedState = () => {
  if (cachedSharedState) return cachedSharedState;
  try {
    const fileToRead = fs.existsSync(STATE_FILE_PATH) ? STATE_FILE_PATH : fs.existsSync(TMP_STATE_FILE_PATH) ? TMP_STATE_FILE_PATH : fs.existsSync(LEGACY_STATE_FILE_PATH) ? LEGACY_STATE_FILE_PATH : null;
    if (fileToRead) {
      const raw = fs.readFileSync(fileToRead, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        let migratedSecrets = false;
        const secretPatch = {};
        if (parsed.sessionHmacSecret) {
          secretPatch.sessionHmacSecret = parsed.sessionHmacSecret;
          delete parsed.sessionHmacSecret;
          migratedSecrets = true;
        }
        if (parsed.adminDriveToken) {
          secretPatch.adminDriveToken = parsed.adminDriveToken;
          secretPatch.adminDriveTokenUpdatedAtMs = parsed.adminDriveTokenUpdatedAtMs || Date.now();
          delete parsed.adminDriveToken;
          delete parsed.adminDriveTokenUpdatedAtMs;
          migratedSecrets = true;
        }
        if (parsed.webPushVapidKeys) {
          secretPatch.webPushVapidKeys = parsed.webPushVapidKeys;
          delete parsed.webPushVapidKeys;
          migratedSecrets = true;
        }
        if (migratedSecrets) {
          writeServerSecrets(secretPatch);
        }
        if (Array.isArray(parsed.authorizedUsers) && parsed.authorizedUsers.length > 0) {
          parsed.authorizedUsers = deduplicateUsersByEmail(parsed.authorizedUsers);
        } else {
          parsed.authorizedUsers = deduplicateUsersByEmail(INITIAL_AUTHORIZED_USERS);
        }
        if (Array.isArray(parsed.classes)) {
          parsed.classes = sanitizeAndDeduplicateClasses(parsed.classes);
        }
        parsed.cloudLinks = {
          photosFolderId: "1FzKx1qghv2_WhOjw7ttvbT_rvaTGYPpn",
          photosFolderUrl: "https://drive.google.com/drive/folders/1FzKx1qghv2_WhOjw7ttvbT_rvaTGYPpn",
          fichasPdfFolderId: "1GDEdQuNfhc0vps4mZXv4LLv4kDLZnauJ",
          fichasPdfFolderUrl: "https://drive.google.com/drive/folders/1GDEdQuNfhc0vps4mZXv4LLv4kDLZnauJ",
          ...parsed.cloudLinks || {}
        };
        if (!parsed.cloudLinks.photosFolderId || parsed.cloudLinks.photosFolderUrl?.includes("my-drive")) {
          parsed.cloudLinks.photosFolderId = "1FzKx1qghv2_WhOjw7ttvbT_rvaTGYPpn";
          parsed.cloudLinks.photosFolderUrl = "https://drive.google.com/drive/folders/1FzKx1qghv2_WhOjw7ttvbT_rvaTGYPpn";
        }
        if (!Array.isArray(parsed.holidays) || parsed.holidays.length === 0) {
          parsed.holidays = OFFICIAL_DEFAULT_HOLIDAYS_2027;
        }
        if (!parsed.officialCalendarConfig || !Array.isArray(parsed.officialCalendarConfig.schoolDays) || parsed.officialCalendarConfig.schoolDays.length !== 200) {
          const defaultDays = generateOfficial200SchoolDays2027(parsed.holidays);
          const validation = parseAndValidateSchoolDates(defaultDays.join("\n"), parsed.holidays);
          parsed.officialCalendarConfig = {
            year: 2027,
            schoolDays: defaultDays,
            calendarDays: validation.calendarDays,
            monthlyDistribution: validation.monthlyDistribution,
            holidays: parsed.holidays,
            updatedAtMs: Date.now(),
            updatedByEmail: "emebjfreitas@jundiai.sp.gov.br",
            updatedByName: "Administrador EMEB Joaquim Candel\xE1rio de Freitas",
            version: 1
          };
        }
        if (!Array.isArray(parsed.calendarAuditLogs) || parsed.calendarAuditLogs.length === 0) {
          parsed.calendarAuditLogs = [
            {
              id: "audit-init-2027",
              timestampISO: (/* @__PURE__ */ new Date()).toISOString(),
              adminEmail: "emebjfreitas@jundiai.sp.gov.br",
              adminName: "Sistema SME Jundia\xED",
              action: "RESTORE_DEFAULT",
              previousDaysCount: 0,
              newDaysCount: 200,
              holidaysCount: OFFICIAL_DEFAULT_HOLIDAYS_2027.length,
              details: "Inicializa\xE7\xE3o oficial da matriz centralizada de 200 dias letivos (2027)."
            }
          ];
        }
        let needsCleanEpochPersist = migratedSecrets;
        if (parsed.cleanResetEpochId !== SERVER_CLEAN_RESET_EPOCH_ID) {
          needsCleanEpochPersist = true;
          const nowEpochMs = Date.now();
          parsed.cleanResetEpochId = SERVER_CLEAN_RESET_EPOCH_ID;
          parsed.classesUpdatedAtMs = nowEpochMs;
          parsed.updatedAtMs = nowEpochMs;
          parsed.accessSessionLogs = [];
          parsed.schoolNotices = [];
          parsed.securityAuditLogs = [];
          parsed.discoveredNominalPdfs = [];
          parsed.discoveredDrivePhotos = [];
          parsed.fcmAlerts = [];
          if (Array.isArray(parsed.classes)) {
            parsed.classes = parsed.classes.map((cls) => ({
              ...cls,
              students: [],
              totalStudents: 0,
              monthlyAbsences: 0,
              presenceRate: 0,
              statusText: "Aguardando importa\xE7\xE3o de estudantes",
              isPending: false,
              weeklyPerformance: [],
              pedagogicalNotes: "",
              updatedAtMs: nowEpochMs
            }));
          }
          if (Array.isArray(parsed.authorizedUsers)) {
            parsed.authorizedUsers = parsed.authorizedUsers.map((u) => ({
              ...u,
              totalAccessCount: 0,
              totalDurationSeconds: 0,
              lastSessionDurationSeconds: 0,
              lastLoginAt: void 0,
              lastActiveAt: void 0,
              lastScreenVisited: void 0
            }));
          }
        }
        const resolvedState = parsed;
        cachedSharedState = resolvedState;
        if (needsCleanEpochPersist) {
          pendingStateFlushDirty = true;
          void flushSharedStateToDiskAsync();
        }
        return resolvedState;
      }
    }
  } catch (err) {
    console.warn("Erro ao ler shared_school_state_2027.json:", err);
  }
  const fallbackState = buildDefaultSharedState();
  cachedSharedState = fallbackState;
  return fallbackState;
};
var writeSharedState = (patch) => {
  const current = readSharedState();
  const next = {
    ...current,
    ...patch,
    ...patch.authorizedUsers ? { authorizedUsers: deduplicateUsersByEmail(patch.authorizedUsers) } : {},
    ...patch.classes ? { classes: sanitizeAndDeduplicateClasses(patch.classes) } : {},
    updatedAtMs: Date.now()
  };
  cachedSharedState = next;
  pendingStateFlushDirty = true;
  void flushSharedStateToDiskAsync();
  return next;
};
var FIREBASE_PROJECT_ID = "listapiloto2027";
var GOOGLE_SECURETOKEN_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
var SESSION_COOKIE_NAME = "emeb_candelario_session";
var SESSION_TTL_SECONDS = 60 * 60 * 12;
var isOfficialSchoolAdminEmail = (email) => {
  if (!email || typeof email !== "string") return false;
  const clean = email.trim().toLowerCase();
  return clean === "emebjfreitas@jundiai.sp.gov.br" || clean === "emebjfreitas@educacao.jundiai.sp.gov.br";
};
var isInstitutionalEmail = (email) => {
  if (!email || typeof email !== "string") return false;
  const clean = email.trim().toLowerCase();
  return clean.endsWith("@educacao.jundiai.sp.gov.br") || clean === "emebjfreitas@jundiai.sp.gov.br";
};
var cachedGoogleCerts = null;
var getGooglePublicCerts = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && cachedGoogleCerts && cachedGoogleCerts.expiresAtMs > now) {
    return cachedGoogleCerts.certs;
  }
  const resp = await fetch(GOOGLE_SECURETOKEN_CERTS_URL);
  if (!resp.ok) {
    if (cachedGoogleCerts) return cachedGoogleCerts.certs;
    throw new Error(`Falha ao buscar chaves p\xFAblicas Google Auth (${resp.status})`);
  }
  const certs = await resp.json();
  const cc = resp.headers.get("cache-control") || "";
  const maxAgeMatch = cc.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Math.max(300, Number(maxAgeMatch[1])) : 3600;
  cachedGoogleCerts = {
    certs,
    expiresAtMs: now + maxAgeSec * 1e3
  };
  return certs;
};
var verifyFirebaseIdToken = async (idToken) => {
  if (!idToken || typeof idToken !== "string") return null;
  const parts = idToken.trim().split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (header?.alg !== "RS256" || typeof header?.kid !== "string" || !header.kid) {
      return null;
    }
    let certs = await getGooglePublicCerts(false);
    let pemCert = certs[header.kid];
    if (!pemCert) {
      certs = await getGooglePublicCerts(true);
      pemCert = certs[header.kid];
    }
    if (!pemCert) return null;
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();
    const sigBuf = Buffer.from(parts[2], "base64url");
    if (!verifier.verify(pemCert, sigBuf)) {
      return null;
    }
    const nowSec = Math.floor(Date.now() / 1e3);
    if (payload.aud !== FIREBASE_PROJECT_ID) return null;
    if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) return null;
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    if (typeof payload.exp !== "number" || payload.exp <= nowSec) return null;
    if (typeof payload.iat !== "number" || payload.iat > nowSec + 300) return null;
    if (typeof payload.auth_time === "number" && payload.auth_time > nowSec + 300) return null;
    if (typeof payload.email !== "string" || !payload.email.trim()) return null;
    if (payload.email_verified !== true) return null;
    return {
      uid: payload.sub,
      email: payload.email.trim().toLowerCase(),
      emailVerified: true,
      name: typeof payload.name === "string" ? payload.name.trim() : void 0
    };
  } catch {
    return null;
  }
};
var runtimeSessionSecret = null;
var getSessionHmacSecret = () => {
  if (process.env.SESSION_HMAC_SECRET && process.env.SESSION_HMAC_SECRET.length >= 24) {
    return process.env.SESSION_HMAC_SECRET;
  }
  if (runtimeSessionSecret) return runtimeSessionSecret;
  const secrets = readServerSecrets();
  if (secrets.sessionHmacSecret && secrets.sessionHmacSecret.length >= 32) {
    runtimeSessionSecret = secrets.sessionHmacSecret;
    return runtimeSessionSecret;
  }
  runtimeSessionSecret = crypto.randomBytes(32).toString("hex");
  writeServerSecrets({ sessionHmacSecret: runtimeSessionSecret });
  return runtimeSessionSecret;
};
var revokeSessionJti = (jti, expSec) => {
  if (!jti || typeof jti !== "string") return;
  const nowSec = Math.floor(Date.now() / 1e3);
  const secrets = readServerSecrets();
  const nextJtis = {};
  for (const [k, exp] of Object.entries(secrets.revokedSessionJtis || {})) {
    if (typeof exp === "number" && exp > nowSec) {
      nextJtis[k] = exp;
    }
  }
  nextJtis[jti] = typeof expSec === "number" && expSec > nowSec ? expSec : nowSec + SESSION_TTL_SECONDS;
  writeServerSecrets({ revokedSessionJtis: nextJtis });
};
var revokeUserSessionsAfter = (email, afterMs = Date.now()) => {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return;
  const secrets = readServerSecrets();
  const nextUsers = { ...secrets.revokedUsersAfterMs || {}, [cleanEmail]: afterMs };
  writeServerSecrets({ revokedUsersAfterMs: nextUsers });
};
var isSessionRevoked = (jti, email, iatSec) => {
  const secrets = readServerSecrets();
  if (jti && secrets.revokedSessionJtis && typeof secrets.revokedSessionJtis[jti] === "number") {
    if (secrets.revokedSessionJtis[jti] > Math.floor(Date.now() / 1e3)) {
      return true;
    }
  }
  const cleanEmail = email.trim().toLowerCase();
  const revokedAfterMs = secrets.revokedUsersAfterMs?.[cleanEmail];
  if (typeof revokedAfterMs === "number" && iatSec * 1e3 < revokedAfterMs) {
    return true;
  }
  return false;
};
var signSessionCookieValue = (payload) => {
  const secret = getSessionHmacSecret();
  const enriched = {
    ...payload,
    iat: typeof payload.iat === "number" ? payload.iat : Math.floor(Date.now() / 1e3),
    jti: payload.jti || crypto.randomUUID()
  };
  const dataB64 = Buffer.from(JSON.stringify(enriched), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(dataB64).digest("base64url");
  return `${dataB64}.${sig}`;
};
var verifySessionCookieValue = (cookieVal) => {
  if (!cookieVal || typeof cookieVal !== "string") return null;
  const dotIdx = cookieVal.indexOf(".");
  if (dotIdx <= 0) return null;
  const dataB64 = cookieVal.slice(0, dotIdx);
  const sigB64 = cookieVal.slice(dotIdx + 1);
  if (!dataB64 || !sigB64) return null;
  try {
    const secret = getSessionHmacSecret();
    const expectedSig = crypto.createHmac("sha256", secret).update(dataB64).digest();
    const incomingSig = Buffer.from(sigB64, "base64url");
    if (expectedSig.length !== incomingSig.length || !crypto.timingSafeEqual(expectedSig, incomingSig)) {
      return null;
    }
    const parsed = JSON.parse(Buffer.from(dataB64, "base64url").toString("utf8"));
    const nowSec = Math.floor(Date.now() / 1e3);
    if (!parsed || typeof parsed.email !== "string" || typeof parsed.exp !== "number") {
      return null;
    }
    if (parsed.exp <= nowSec) return null;
    const cleanEmail = parsed.email.trim().toLowerCase();
    const iatSec = typeof parsed.iat === "number" ? parsed.iat : 0;
    const jti = typeof parsed.jti === "string" ? parsed.jti : void 0;
    if (isSessionRevoked(jti, cleanEmail, iatSec)) {
      return null;
    }
    return {
      email: cleanEmail,
      uid: String(parsed.uid || ""),
      name: String(parsed.name || ""),
      exp: parsed.exp,
      iat: iatSec,
      jti
    };
  } catch {
    return null;
  }
};
var parseCookiesFromRequest = (req) => {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw || typeof raw !== "string") return out;
  for (const part of raw.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx <= 0) continue;
    const k = part.slice(0, eqIdx).trim();
    const v = part.slice(eqIdx + 1).trim();
    if (k) {
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
  }
  return out;
};
var getTodaySaoPauloIso = () => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(/* @__PURE__ */ new Date());
  } catch {
    return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  }
};
var buildAuthorizedRequestUser = (verifiedEmail, displayName, uid, authMethod = "firebase_jwt") => {
  const email = verifiedEmail.trim().toLowerCase();
  if (!isInstitutionalEmail(email)) {
    return { user: null, denialReason: "NON_INSTITUTIONAL_EMAIL" };
  }
  const state = readSharedState();
  const users = Array.isArray(state.authorizedUsers) ? state.authorizedUsers : [];
  const matched = users.find(
    (u) => u && typeof u.email === "string" && u.email.trim().toLowerCase() === email
  );
  if (matched) {
    if (matched.active === false) {
      return { user: null, denialReason: "USER_DEACTIVATED" };
    }
    if (matched.accessExpiresAt && typeof matched.accessExpiresAt === "string") {
      const todayIso = getTodaySaoPauloIso();
      if (/^\d{4}-\d{2}-\d{2}$/.test(matched.accessExpiresAt.trim()) && todayIso > matched.accessExpiresAt.trim()) {
        return { user: null, denialReason: "USER_ACCESS_EXPIRED" };
      }
    }
  }
  const isAdmin = isOfficialSchoolAdminEmail(email);
  if (!matched && !isAdmin) {
    return { user: null, denialReason: "USER_NOT_PROVISIONED" };
  }
  const resolvedRole = isAdmin ? "admin" : matched?.role === "peb2" ? "peb2" : "usuario";
  const resolvedName = matched?.name && String(matched.name).trim() || displayName || (isAdmin ? "Equipe Administrativa" : email.split("@")[0] || "Usu\xE1rio");
  return {
    user: {
      email,
      role: resolvedRole,
      name: resolvedName,
      isAdmin,
      isInstitutional: true,
      uid,
      authMethod
    }
  };
};
var resolveVerifiedRequestUser = async (req) => {
  const cached = req.verifiedUser;
  if (cached && cached.isInstitutional) {
    return { user: cached };
  }
  const authHeader = String(req.headers.authorization || "").trim();
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    const verified = await verifyFirebaseIdToken(token);
    if (!verified) {
      return { user: null, denialReason: "INVALID_OR_EXPIRED_FIREBASE_TOKEN" };
    }
    const built = buildAuthorizedRequestUser(
      verified.email,
      verified.name,
      verified.uid,
      "firebase_jwt"
    );
    if (built.user) {
      req.verifiedUser = built.user;
    }
    return built;
  }
  const cookies = parseCookiesFromRequest(req);
  const sessionCookie = cookies[SESSION_COOKIE_NAME];
  if (sessionCookie) {
    const parsed = verifySessionCookieValue(sessionCookie);
    if (!parsed) {
      return { user: null, denialReason: "INVALID_OR_EXPIRED_SESSION_COOKIE" };
    }
    const built = buildAuthorizedRequestUser(
      parsed.email,
      parsed.name,
      parsed.uid,
      "signed_cookie"
    );
    if (built.user) {
      req.verifiedUser = built.user;
    }
    return built;
  }
  return { user: null, denialReason: "MISSING_AUTHENTICATION_TOKEN" };
};
var extractRequestUser = (req) => {
  const verified = req.verifiedUser;
  if (verified) return verified;
  return {
    email: "",
    role: "anonymous",
    name: "An\xF4nimo",
    isAdmin: false,
    isInstitutional: false,
    authMethod: "anonymous"
  };
};
var maskServerSensitiveText = (text, type) => {
  if (!text || typeof text !== "string") return "";
  const clean = text.trim();
  if (!clean) return "";
  if (clean.length < 3) return "***";
  if (type === "cpf") {
    const digits = clean.replace(/\D/g, "");
    if (digits.length === 11) return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
    return `***.***.***-${digits.slice(-2) || "**"}`;
  }
  if (type === "nis") {
    const digits = clean.replace(/\D/g, "");
    if (digits.length >= 10) return `***.${digits.slice(3, 8)}.***-*`;
    return "***.*****.***-*";
  }
  if (type === "sus") {
    const digits = clean.replace(/\D/g, "");
    if (digits.length >= 4) return `*** **** **** ${digits.slice(-4)}`;
    return "*** **** **** ****";
  }
  if (type === "phone") {
    const digits = clean.replace(/\D/g, "");
    if (digits.length >= 10) return `(${digits.slice(0, 2)}) *****-${digits.slice(-4)}`;
    if (digits.length >= 4) return `*****-${digits.slice(-4)}`;
    return "(**) *****-****";
  }
  if (type === "rg") {
    const alnum = clean.replace(/[^a-zA-Z0-9]/g, "");
    if (alnum.length >= 3) return `**.***.***-${alnum.slice(-1).toUpperCase()}`;
    return "**.***.***-*";
  }
  if (type === "cep") {
    const digits = clean.replace(/\D/g, "");
    if (digits.length === 8) return `*****-${digits.slice(-3)}`;
    return "*****-***";
  }
  if (type === "address") {
    return clean.replace(/\d+/g, "***");
  }
  return "***";
};
var getAllowedTeacherClassIdsForUser = (state, userEmail) => {
  const cleanEmail = userEmail.trim().toLowerCase();
  const allowed = /* @__PURE__ */ new Set();
  const matchedUser = (state.authorizedUsers || []).find(
    (u) => u && typeof u.email === "string" && u.email.trim().toLowerCase() === cleanEmail
  );
  if (matchedUser?.assignedClassId && matchedUser.assignedClassId !== "all") {
    allowed.add(String(matchedUser.assignedClassId).toLowerCase());
  }
  if (Array.isArray(matchedUser?.assignedClassIds)) {
    matchedUser.assignedClassIds.forEach((id) => {
      if (id && id !== "all") allowed.add(String(id).toLowerCase());
    });
  }
  (state.classes || []).forEach((c) => {
    if (!c?.id) return;
    const primary = String(c.teacherEmail || "").trim().toLowerCase();
    const extraMatch = Array.isArray(c.authorizedTeacherEmails) && c.authorizedTeacherEmails.some(
      (e) => typeof e === "string" && e.trim().toLowerCase() === cleanEmail
    );
    if (primary === cleanEmail || extraMatch) {
      allowed.add(String(c.id).toLowerCase());
    }
  });
  return allowed;
};
var maskStudentForServerRole = (st, role) => {
  if (!st || typeof st !== "object" || role === "admin") return st;
  const baseMasked = {
    ...st,
    cpf: st.cpf ? maskServerSensitiveText(st.cpf, "cpf") : void 0,
    rg: st.rg ? maskServerSensitiveText(st.rg, "rg") : void 0,
    dataEmissaoRg: st.dataEmissaoRg ? "**/**/****" : void 0,
    nis: st.nis ? maskServerSensitiveText(st.nis, "nis") : void 0,
    cartaoSus: st.cartaoSus ? maskServerSensitiveText(st.cartaoSus, "sus") : void 0,
    cep: st.cep ? maskServerSensitiveText(st.cep, "cep") : void 0,
    logradouro: st.logradouro ? maskServerSensitiveText(st.logradouro, "address") : void 0,
    numeroResidencia: st.numeroResidencia ? "***" : void 0,
    complemento: st.complemento ? "***" : void 0
  };
  if (role === "peb2") {
    return {
      ...baseMasked,
      telefones: st.telefones ? maskServerSensitiveText(st.telefones, "phone") : void 0,
      guardianPhone: st.guardianPhone ? maskServerSensitiveText(st.guardianPhone, "phone") : void 0,
      fichaPdfDriveId: void 0,
      fichaPdfDriveUrl: void 0,
      fichaPdfSubfolder: void 0,
      fichaPdfSha256: void 0,
      fichaPdfManualLink: false
    };
  }
  return baseMasked;
};
var filterClassesForUser = (classes, state, reqUser) => {
  if (!Array.isArray(classes)) return [];
  if (reqUser.isAdmin) return classes;
  if (reqUser.role === "peb2") {
    return classes.map((cls) => ({
      ...cls,
      students: Array.isArray(cls?.students) ? cls.students.map((st) => maskStudentForServerRole(st, "peb2")) : []
    }));
  }
  const allowedClassIds = getAllowedTeacherClassIdsForUser(state, reqUser.email);
  return classes.filter((cls) => cls?.id && allowedClassIds.has(String(cls.id).toLowerCase())).map((cls) => ({
    ...cls,
    students: Array.isArray(cls?.students) ? cls.students.map((st) => maskStudentForServerRole(st, "usuario")) : []
  }));
};
var sanitizeUsersForRole = (users, reqUser) => {
  if (!Array.isArray(users) || reqUser.isAdmin) return users;
  return users.map((u) => {
    if (!u || typeof u !== "object") return u;
    const email = String(u.email || "").trim().toLowerCase();
    if (email === reqUser.email) return u;
    return {
      id: u.id,
      name: u.name,
      role: u.role,
      teacherRoleType: u.teacherRoleType,
      pronoun: u.pronoun,
      firstName: u.firstName,
      subjectName: u.subjectName,
      email: u.email,
      assignedClassId: u.assignedClassId,
      assignedClassIds: u.assignedClassIds,
      assignedClassName: u.assignedClassName,
      assignedClassNames: u.assignedClassNames,
      active: u.active,
      updatedAtMs: u.updatedAtMs
    };
  });
};
var filterSchoolStateForUser = (state, reqUser) => {
  const { fcmTokens: _hiddenFcmTokens, lastAutoFcmWindowKey: _hiddenKey, ...publicState } = state;
  if (reqUser.isAdmin) return publicState;
  const allowedClassIds = reqUser.role === "peb2" ? null : getAllowedTeacherClassIdsForUser(state, reqUser.email);
  const filteredClasses = filterClassesForUser(state.classes, state, reqUser);
  const ownedFileTokens = /* @__PURE__ */ new Set();
  filteredClasses.forEach((cls) => {
    (cls.students || []).forEach((st) => {
      if (st?.id) ownedFileTokens.add(String(st.id).replace(/[^a-zA-Z0-9-_]/g, "_").toLowerCase());
      if (st?.fichaPdfDriveUrl) ownedFileTokens.add(String(st.fichaPdfDriveUrl).toLowerCase());
    });
  });
  return {
    ...publicState,
    classes: filteredClasses,
    authorizedUsers: sanitizeUsersForRole(state.authorizedUsers, reqUser),
    accessSessionLogs: Array.isArray(state.accessSessionLogs) ? state.accessSessionLogs.filter(
      (l) => l && String(l.email || "").trim().toLowerCase() === reqUser.email
    ) : [],
    securityAuditLogs: [],
    discoveredNominalPdfs: reqUser.role === "peb2" ? [] : Array.isArray(state.discoveredNominalPdfs) ? state.discoveredNominalPdfs.filter((p) => {
      const cid = String(p?.classId || "").toLowerCase();
      const sid = String(p?.studentId || "").replace(/[^a-zA-Z0-9-_]/g, "_").toLowerCase();
      return cid && allowedClassIds?.has(cid) || sid && ownedFileTokens.has(sid);
    }) : []
  };
};
var personalizeRealtimeEventForUser = (type, payload, reqUser, state) => {
  if (reqUser.isAdmin) return payload;
  const next = { ...payload };
  if (Array.isArray(next.classes)) {
    next.classes = filterClassesForUser(next.classes, state, reqUser);
    if (type === "classes:updated" && next.classes.length === 0) {
      return null;
    }
  }
  if (Array.isArray(next.authorizedUsers)) {
    next.authorizedUsers = sanitizeUsersForRole(next.authorizedUsers, reqUser);
  }
  if (Array.isArray(next.accessSessionLogs)) {
    next.accessSessionLogs = next.accessSessionLogs.filter(
      (l) => l && String(l.email || "").trim().toLowerCase() === reqUser.email
    );
  }
  if (Array.isArray(next.securityAuditLogs)) {
    next.securityAuditLogs = [];
  }
  if (reqUser.role === "peb2" && Array.isArray(next.discoveredNominalPdfs)) {
    next.discoveredNominalPdfs = [];
  }
  return next;
};
var canUserAccessOrMutateStudent = (state, reqUser, targetIdOrFilename, mode) => {
  if (reqUser.isAdmin) return true;
  if (reqUser.role === "peb2") {
    if (mode !== "read_photo") return false;
    const stem2 = path.basename(targetIdOrFilename.split("?")[0]).replace(/\.[^/.]+$/, "").toLowerCase();
    return (state.classes || []).some(
      (cls) => Array.isArray(cls?.students) && cls.students.some(
        (st) => st?.id && (String(st.id).toLowerCase() === stem2 || String(st.id).replace(/[^a-zA-Z0-9-_]/g, "_").toLowerCase() === stem2)
      )
    );
  }
  if (reqUser.role !== "usuario") return false;
  const allowedClassIds = getAllowedTeacherClassIdsForUser(state, reqUser.email);
  if (allowedClassIds.size === 0) return false;
  const cleanTarget = targetIdOrFilename.split("?")[0];
  const baseName = path.basename(cleanTarget).toLowerCase();
  const stem = baseName.replace(/\.[^/.]+$/, "");
  const sanitizedTarget = cleanTarget.replace(/[^a-zA-Z0-9-_]/g, "_").toLowerCase();
  return (state.classes || []).some((cls) => {
    if (!cls?.id || !allowedClassIds.has(String(cls.id).toLowerCase())) return false;
    return (cls.students || []).some((st) => {
      if (!st?.id) return false;
      const stIdLower = String(st.id).toLowerCase();
      const stIdSafe = String(st.id).replace(/[^a-zA-Z0-9-_]/g, "_").toLowerCase();
      const stPhotoFile = String(st.photo || "").split("?")[0].split("/").pop()?.toLowerCase() || "";
      const stPdfFile = String(st.fichaPdfDriveUrl || "").split("?")[0].split("/").pop()?.toLowerCase() || "";
      return stIdLower === cleanTarget.toLowerCase() || stIdSafe === sanitizedTarget || stIdSafe === stem || stPhotoFile === baseName || stPdfFile === baseName;
    });
  });
};
var recordSecurityAuditLog = (eventType, details, req, status = "SUCCESS", overrideUser) => {
  const user = overrideUser || extractRequestUser(req);
  const clientIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1";
  const entry = {
    id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestampISO: (/* @__PURE__ */ new Date()).toISOString(),
    eventType,
    userEmail: user.email || "ANONYMOUS",
    userName: user.name || (user.email === "emebjfreitas@jundiai.sp.gov.br" ? "Equipe Administrativa" : "Usu\xE1rio"),
    clientIp,
    details,
    status
  };
  const current = readSharedState();
  const existingLogs = Array.isArray(current.securityAuditLogs) ? current.securityAuditLogs : [];
  writeSharedState({
    securityAuditLogs: [entry, ...existingLogs].slice(0, 500)
  });
  return entry;
};
var requireInstitutionalAuth = async (req, res, next) => {
  const { user, denialReason } = await resolveVerifiedRequestUser(req);
  if (!user || !user.isInstitutional) {
    if (req.method !== "GET" || denialReason !== "MISSING_AUTHENTICATION_TOKEN") {
      recordSecurityAuditLog(
        "UNAUTHORIZED_MUTATION_ATTEMPT",
        `Acesso bloqueado em ${req.method} ${req.path} (${denialReason || "UNAUTHENTICATED"}).`,
        req,
        "BLOCKED",
        { email: user?.email || "ANONYMOUS", name: user?.name || "N\xE3o Autenticado" }
      );
    }
    const statusCode = denialReason === "MISSING_AUTHENTICATION_TOKEN" || denialReason === "INVALID_OR_EXPIRED_FIREBASE_TOKEN" || denialReason === "INVALID_OR_EXPIRED_SESSION_COOKIE" ? 401 : 403;
    res.status(statusCode).json({
      error: statusCode === 401 ? "Sess\xE3o n\xE3o autenticada ou expirada. Fa\xE7a login novamente com sua conta Google institucional." : "Acesso negado. Conta institucional desativada, expirada ou fora do dom\xEDnio oficial.",
      code: denialReason || "UNAUTHORIZED_INSTITUTIONAL_EMAIL"
    });
    return;
  }
  next();
};
var requireAdminAuth = async (req, res, next) => {
  const { user, denialReason } = await resolveVerifiedRequestUser(req);
  if (!user || !user.isInstitutional) {
    recordSecurityAuditLog(
      "UNAUTHORIZED_ADMIN_ATTEMPT",
      `Tentativa n\xE3o autenticada bloqueada em rota administrativa ${req.path} (${denialReason || "UNAUTHENTICATED"}).`,
      req,
      "BLOCKED",
      { email: "ANONYMOUS", name: "N\xE3o Autenticado" }
    );
    res.status(401).json({
      error: "Autentica\xE7\xE3o administrativa obrigat\xF3ria.",
      code: denialReason || "UNAUTHENTICATED"
    });
    return;
  }
  if (!user.isAdmin) {
    recordSecurityAuditLog(
      "PRIVILEGE_ESCALATION_BLOCKED",
      `Tentativa de opera\xE7\xE3o administrativa bloqueada em ${req.path} para o usu\xE1rio verificado: "${user.email}"`,
      req,
      "BLOCKED",
      user
    );
    res.status(403).json({
      error: "Acesso negado. Esta opera\xE7\xE3o exige privil\xE9gios de Administrador Escolar (Dire\xE7\xE3o / Secretaria).",
      code: "ADMIN_ROLE_REQUIRED"
    });
    return;
  }
  next();
};
var requireCurrentCleanEpoch = (req, res, next) => {
  const clientEpoch = String(req.headers["x-clean-epoch"] || "").trim();
  if (clientEpoch !== SERVER_CLEAN_RESET_EPOCH_ID) {
    res.status(409).json({
      error: "Estado anterior \xE0 limpeza do banco ignorado. Recarregue a aplica\xE7\xE3o.",
      code: "STALE_EPOCH_REJECTED"
    });
    return;
  }
  next();
};
var getRequestClientId = (req) => {
  const raw = req.headers["x-realtime-client-id"];
  if (typeof raw !== "string") return void 0;
  const trimmed = raw.trim().slice(0, 128);
  return trimmed || void 0;
};
async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3e3;
  const wsClients = /* @__PURE__ */ new Set();
  const sseClients = /* @__PURE__ */ new Set();
  const broadcastRealtimeEvent = (type, payload, originClientId) => {
    const state = readSharedState();
    const baseEnvelope = {
      ...payload,
      ...originClientId ? { originClientId } : {}
    };
    const ts = Date.now();
    let adminSerialized = null;
    const getAdminSerialized = () => {
      if (!adminSerialized) {
        adminSerialized = JSON.stringify({ type, payload: baseEnvelope, ts });
      }
      return adminSerialized;
    };
    wsClients.forEach((client) => {
      if (!client.user || !client.user.isInstitutional) return;
      if (originClientId && client.clientId && client.clientId === originClientId) return;
      if (client.ws.readyState !== WebSocket.OPEN) return;
      try {
        if (client.user.isAdmin) {
          client.ws.send(getAdminSerialized());
          return;
        }
        const personalized = personalizeRealtimeEventForUser(type, baseEnvelope, client.user, state);
        if (!personalized) return;
        client.ws.send(JSON.stringify({ type, payload: personalized, ts }));
      } catch {
      }
    });
    sseClients.forEach((client) => {
      if (!client.user || !client.user.isInstitutional) return;
      if (originClientId && client.clientId && client.clientId === originClientId) return;
      if (client.res.writableEnded) return;
      try {
        if (client.user.isAdmin) {
          client.res.write(`data: ${getAdminSerialized()}

`);
          return;
        }
        const personalized = personalizeRealtimeEventForUser(type, baseEnvelope, client.user, state);
        if (!personalized) return;
        client.res.write(`data: ${JSON.stringify({ type, payload: personalized, ts })}

`);
      } catch {
        sseClients.delete(client);
      }
    });
  };
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    const xfProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
    const isHttps = req.secure || xfProto.includes("https");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    );
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    if (isHttps) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    const scriptDirective = process.env.NODE_ENV === "production" ? "script-src 'self' 'unsafe-inline' https:;" : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:;";
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self' 'unsafe-inline' https: blob: data:; ${scriptDirective} object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; frame-src 'self' https: data: blob:; img-src 'self' https: data: blob:;`
    );
    next();
  });
  app.use("/api", (req, res, next) => {
    const method = req.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      next();
      return;
    }
    const authHeader = String(req.headers.authorization || "").trim();
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      next();
      return;
    }
    const expectedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().toLowerCase();
    const origin = String(req.headers.origin || "").trim();
    const referer = String(req.headers.referer || "").trim();
    if (origin && origin !== "null") {
      try {
        const originHost = new URL(origin).host.toLowerCase();
        if (expectedHost && originHost !== expectedHost) {
          res.status(403).json({
            error: "Origem da requisi\xE7\xE3o n\xE3o autorizada para esta opera\xE7\xE3o.",
            code: "CSRF_ORIGIN_MISMATCH"
          });
          return;
        }
      } catch {
        res.status(403).json({ error: "Cabe\xE7alho Origin inv\xE1lido.", code: "INVALID_ORIGIN" });
        return;
      }
    } else if (referer) {
      try {
        const refererHost = new URL(referer).host.toLowerCase();
        if (expectedHost && refererHost !== expectedHost) {
          res.status(403).json({
            error: "Origem Referer da requisi\xE7\xE3o n\xE3o autorizada.",
            code: "CSRF_REFERER_MISMATCH"
          });
          return;
        }
      } catch {
        res.status(403).json({ error: "Cabe\xE7alho Referer inv\xE1lido.", code: "INVALID_REFERER" });
        return;
      }
    } else {
      const hasCustomHeader = Boolean(req.headers["x-requested-with"]) || Boolean(req.headers["x-realtime-client-id"]);
      if (!hasCustomHeader) {
        res.status(403).json({
          error: "Cabe\xE7alho anti-CSRF obrigat\xF3rio ausente.",
          code: "CSRF_HEADER_REQUIRED"
        });
        return;
      }
    }
    next();
  });
  const rateLimitBuckets = /* @__PURE__ */ new Map();
  const applyRateLimit = (bucketPrefix, maxReq, windowMs) => {
    return (req, res, next) => {
      const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1").split(",")[0].trim();
      const key = `${bucketPrefix}:${ip}`;
      const now = Date.now();
      const current = rateLimitBuckets.get(key);
      if (!current || current.resetAtMs <= now) {
        if (rateLimitBuckets.size > 4e3) rateLimitBuckets.clear();
        rateLimitBuckets.set(key, { count: 1, resetAtMs: now + windowMs });
        next();
        return;
      }
      if (current.count >= maxReq) {
        res.status(429).json({
          error: "Muitas requisi\xE7\xF5es em sequ\xEAncia. Aguarde alguns segundos e tente novamente.",
          code: "RATE_LIMIT_EXCEEDED"
        });
        return;
      }
      current.count += 1;
      next();
    };
  };
  app.use("/api/auth/session", applyRateLimit("auth", 30, 6e4));
  app.use("/api/auth/logout", applyRateLimit("auth_logout", 30, 6e4));
  app.use("/api/school-state", applyRateLimit("school_state", 180, 6e4));
  app.use("/api/fcm", applyRateLimit("fcm", 90, 6e4));
  app.use("/api/security-logs", applyRateLimit("sec_logs", 90, 6e4));
  app.use("/api/photos", applyRateLimit("photos", 240, 6e4));
  app.use("/api/pdfs", applyRateLimit("pdfs", 240, 6e4));
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  const setSessionCookieHeader = (req, res, cookieValue, maxAgeSec) => {
    const xfProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
    const isSecure = req.secure || xfProto.includes("https");
    const attrs = [
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(cookieValue)}`,
      "Path=/",
      `Max-Age=${maxAgeSec}`,
      "HttpOnly",
      isSecure ? "SameSite=None" : "SameSite=Lax",
      ...isSecure ? ["Secure", "Partitioned"] : []
    ];
    res.setHeader("Set-Cookie", attrs.join("; "));
  };
  app.get("/api/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, service: "emeb-candelario-2027" });
  });
  app.post("/api/auth/session", async (req, res) => {
    try {
      const authHeader = String(req.headers.authorization || "").trim();
      const validation = validateAuthSessionRequest(req.body, authHeader);
      if (!validation.ok) {
        res.status(400).json({ error: validation.error, code: "MISSING_OR_INVALID_ID_TOKEN" });
        return;
      }
      const rawToken = validation.data.idToken;
      const verified = await verifyFirebaseIdToken(rawToken);
      if (!verified) {
        recordSecurityAuditLog(
          "LOGIN_FAILURE",
          "Token Firebase ID inv\xE1lido, expirado ou com e-mail n\xE3o verificado rejeitado em /api/auth/session.",
          req,
          "BLOCKED",
          { email: "ANONYMOUS", name: "Falha JWT" }
        );
        res.status(401).json({
          error: "Token de autentica\xE7\xE3o inv\xE1lido ou expirado.",
          code: "INVALID_FIREBASE_TOKEN"
        });
        return;
      }
      const { user, denialReason } = buildAuthorizedRequestUser(
        verified.email,
        verified.name,
        verified.uid,
        "firebase_jwt"
      );
      if (!user) {
        recordSecurityAuditLog(
          "LOGIN_FAILURE",
          `Login bloqueado para "${verified.email}" (${denialReason || "UNAUTHORIZED"}).`,
          req,
          "BLOCKED",
          { email: verified.email, name: verified.name || verified.email }
        );
        res.status(403).json({
          error: "Conta n\xE3o autorizada para acesso institucional.",
          code: denialReason || "UNAUTHORIZED"
        });
        return;
      }
      const exp = Math.floor(Date.now() / 1e3) + SESSION_TTL_SECONDS;
      const cookieToken = signSessionCookieValue({
        email: user.email,
        uid: verified.uid,
        name: user.name,
        exp
      });
      setSessionCookieHeader(req, res, cookieToken, SESSION_TTL_SECONDS);
      recordSecurityAuditLog(
        "LOGIN_SUCCESS",
        `Sess\xE3o autenticada com criptografia Firebase + HMAC para ${user.email} (${user.role}).`,
        req,
        "SUCCESS",
        user
      );
      res.json({
        ok: true,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
        expiresAtSec: exp
      });
    } catch (err) {
      res.status(500).json({ error: err?.message || "Erro interno ao autenticar sess\xE3o." });
    }
  });
  app.post("/api/auth/logout", (req, res) => {
    try {
      const cookies = parseCookiesFromRequest(req);
      const rawCookie = cookies[SESSION_COOKIE_NAME];
      if (rawCookie) {
        const parsed = verifySessionCookieValue(rawCookie);
        if (parsed?.jti) {
          revokeSessionJti(parsed.jti, parsed.exp);
        }
      }
    } catch {
    }
    setSessionCookieHeader(req, res, "", 0);
    res.json({ ok: true });
  });
  app.get("/api/realtime/stream", requireInstitutionalAuth, (req, res) => {
    const user = extractRequestUser(req);
    const queryClientId = typeof req.query.clientId === "string" ? req.query.clientId.trim().slice(0, 128) : void 0;
    const clientId = queryClientId || getRequestClientId(req);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }
    const clientEntry = { res, user, clientId };
    sseClients.add(clientEntry);
    try {
      res.write(`data: ${JSON.stringify({ type: "ready", ts: Date.now() })}

`);
    } catch {
      sseClients.delete(clientEntry);
      return;
    }
    const keepaliveId = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(keepaliveId);
        sseClients.delete(clientEntry);
        return;
      }
      try {
        res.write(`: keepalive ${Date.now()}

`);
      } catch {
        clearInterval(keepaliveId);
        sseClients.delete(clientEntry);
      }
    }, 25e3);
    req.on("close", () => {
      clearInterval(keepaliveId);
      sseClients.delete(clientEntry);
    });
  });
  app.get("/api/school-state", requireInstitutionalAuth, (req, res) => {
    const reqUser = extractRequestUser(req);
    const state = readSharedState();
    const filtered = filterSchoolStateForUser(state, reqUser);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json(filtered);
  });
  app.post("/api/school-state/drive-token", requireAdminAuth, (req, res) => {
    const validation = validateDriveTokenPayload(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    writeServerSecrets({
      adminDriveToken: validation.data.accessToken,
      adminDriveTokenUpdatedAtMs: Date.now()
    });
    res.json({ ok: true });
  });
  const PHOTOS_DIR = path.join(DATA_DIR, "emeb_candelario_student_photos_v1");
  if (!fs.existsSync(PHOTOS_DIR)) {
    try {
      fs.mkdirSync(PHOTOS_DIR, { recursive: true });
    } catch {
    }
  }
  const PHOTO_MIME_BY_EXT = {
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".avif": "image/avif"
  };
  const detectImageTypeFromBuffer = (buf) => {
    if (!buf || buf.length < 12) return null;
    if (buf[0] === 255 && buf[1] === 216 && buf[2] === 255) {
      return { valid: true, ext: "jpg", mime: "image/jpeg" };
    }
    if (buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71) {
      return { valid: true, ext: "png", mime: "image/png" };
    }
    if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") {
      return { valid: true, ext: "webp", mime: "image/webp" };
    }
    if (buf.slice(0, 4).toString("ascii") === "GIF8") {
      return { valid: true, ext: "gif", mime: "image/gif" };
    }
    if (buf.slice(4, 8).toString("ascii") === "ftyp") {
      return { valid: true, ext: "avif", mime: "image/avif" };
    }
    return null;
  };
  const hasPdfSignatureInBuffer = (buf) => {
    if (!buf || buf.length < 8) return false;
    const head = buf.slice(0, Math.min(buf.length, 1024));
    return head.indexOf("%PDF-") !== -1;
  };
  const decodeBinaryUploadPacket = (raw) => {
    if (!Buffer.isBuffer(raw) || raw.length < 10) {
      throw new Error("Pacote bin\xE1rio inv\xE1lido ou vazio.");
    }
    if (raw.slice(0, 4).toString("ascii") !== "EMEB") {
      throw new Error("Cabe\xE7alho de pacote bin\xE1rio inv\xE1lido.");
    }
    const metaLen = raw.readUInt32BE(4);
    if (metaLen <= 0 || metaLen > 5 * 1024 * 1024 || 8 + metaLen > raw.length) {
      throw new Error("Tamanho de metadados do pacote bin\xE1rio inv\xE1lido.");
    }
    const meta = JSON.parse(raw.slice(8, 8 + metaLen).toString("utf8"));
    if (!meta || !Array.isArray(meta.items)) {
      throw new Error("Metadados do pacote bin\xE1rio malformados.");
    }
    let offset = 8 + metaLen;
    const decoded = [];
    for (const item of meta.items) {
      const len = Number(item?.byteLength || 0);
      if (!item?.studentId || !Number.isFinite(len) || len <= 0 || offset + len > raw.length) {
        throw new Error(`Payload bin\xE1rio corrompido para estudante ${item?.studentId || "desconhecido"}.`);
      }
      const slice = raw.subarray(offset, offset + len);
      offset += len;
      const computedSha = crypto.createHash("sha256").update(slice).digest("hex");
      decoded.push({
        studentId: String(item.studentId),
        mimeType: item.mimeType ? String(item.mimeType) : void 0,
        ext: item.ext ? String(item.ext) : void 0,
        sha256: item.sha256 ? String(item.sha256) : computedSha,
        buffer: slice
      });
    }
    return decoded;
  };
  const removeStaleStudentPhotoExtensions = (cleanId, keepExt) => {
    const exts = ["jpg", "jpeg", "png", "webp", "gif", "avif"];
    for (const ext of exts) {
      if (ext === keepExt) continue;
      const candidate = path.join(PHOTOS_DIR, `${cleanId}.${ext}`);
      if (fs.existsSync(candidate)) {
        try {
          fs.unlinkSync(candidate);
        } catch {
        }
      }
    }
  };
  app.get("/api/photos/:filename", requireInstitutionalAuth, (req, res) => {
    const filename = path.basename(req.params.filename || "");
    if (!filename || filename === "." || filename === ".." || String(req.params.filename || "").includes("..")) {
      res.status(400).end();
      return;
    }
    const reqUser = extractRequestUser(req);
    const state = readSharedState();
    if (!canUserAccessOrMutateStudent(state, reqUser, filename, "read_photo")) {
      res.status(403).json({
        error: "Acesso negado \xE0 foto de estudante fora da sua turma atribu\xEDda.",
        code: "CLASS_OWNERSHIP_FORBIDDEN"
      });
      return;
    }
    const resolvedPhotosRoot = path.resolve(PHOTOS_DIR) + path.sep;
    let filePath = path.resolve(PHOTOS_DIR, filename);
    if (!filePath.startsWith(resolvedPhotosRoot)) {
      res.status(400).end();
      return;
    }
    if (!fs.existsSync(filePath)) {
      const stem = filename.replace(/\.[^/.]+$/, "");
      for (const fallbackExt of [".webp", ".jpg", ".jpeg", ".png"]) {
        const altPath = path.resolve(PHOTOS_DIR, `${stem}${fallbackExt}`);
        if (altPath.startsWith(resolvedPhotosRoot) && fs.existsSync(altPath)) {
          filePath = altPath;
          break;
        }
      }
    }
    if (!fs.existsSync(filePath)) {
      res.status(404).end();
      return;
    }
    const resolvedExt = path.extname(filePath).toLowerCase();
    res.setHeader("Content-Type", PHOTO_MIME_BY_EXT[resolvedExt] || "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=86400");
    fs.createReadStream(filePath).pipe(res);
  });
  const savePhotoBufferToFile = (studentId, buffer) => {
    const detected = detectImageTypeFromBuffer(buffer);
    if (!detected) {
      throw new Error(`Arquivo de imagem inv\xE1lido ou formato n\xE3o suportado para ${studentId}.`);
    }
    const cleanId = String(studentId).replace(/[^a-zA-Z0-9-_]/g, "_");
    const filename = `${cleanId}.${detected.ext}`;
    const filePath = path.join(PHOTOS_DIR, filename);
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    removeStaleStudentPhotoExtensions(cleanId, detected.ext);
    let needsWrite = true;
    if (fs.existsSync(filePath)) {
      try {
        const existingBuf = fs.readFileSync(filePath);
        const existingSha = crypto.createHash("sha256").update(existingBuf).digest("hex");
        if (existingSha === sha256) {
          needsWrite = false;
        }
      } catch {
        needsWrite = true;
      }
    }
    if (needsWrite) {
      fs.writeFileSync(filePath, buffer);
    }
    return {
      photoUrl: `/api/photos/${filename}`,
      sha256,
      filename
    };
  };
  const savePhotoDataUrlToFile = (studentId, dataUrl) => {
    const matches = dataUrl.match(/^data:([A-Za-z0-9\-+\/]+);base64,(.+)$/);
    const buffer = matches && matches.length === 3 ? Buffer.from(matches[2], "base64") : Buffer.from(dataUrl);
    return savePhotoBufferToFile(studentId, buffer);
  };
  const applyPhotoBatchToState = (items, originClientId) => {
    const current = readSharedState();
    const existingStudentShaMap = /* @__PURE__ */ new Map();
    if (Array.isArray(current.classes)) {
      for (const cls of current.classes) {
        if (!Array.isArray(cls.students)) continue;
        for (const s of cls.students) {
          if (s?.id) {
            existingStudentShaMap.set(s.id, { sha256: s.photoSha256, photo: s.photo });
          }
        }
      }
    }
    const now = Date.now();
    const photoMap = /* @__PURE__ */ new Map();
    let skippedCount = 0;
    for (const item of items) {
      if (!item.studentId || !item.buffer || item.buffer.length === 0) continue;
      const incomingSha = item.sha256 || crypto.createHash("sha256").update(item.buffer).digest("hex");
      const existingInfo = existingStudentShaMap.get(item.studentId);
      const cleanId = String(item.studentId).replace(/[^a-zA-Z0-9-_]/g, "_");
      if (existingInfo?.sha256 && existingInfo.sha256 === incomingSha && existingInfo.photo) {
        const rawPathName = existingInfo.photo.split("?")[0].split("/").pop() || `${cleanId}.webp`;
        if (fs.existsSync(path.join(PHOTOS_DIR, rawPathName))) {
          skippedCount++;
          continue;
        }
      }
      const saved = savePhotoBufferToFile(item.studentId, item.buffer);
      photoMap.set(item.studentId, { url: `${saved.photoUrl}?v=${now}`, sha256: saved.sha256 });
    }
    let updatedCount = 0;
    const changedClasses = [];
    if (photoMap.size > 0 && Array.isArray(current.classes)) {
      current.classes = current.classes.map((cls) => {
        if (!Array.isArray(cls.students)) return cls;
        let clsUpdated = false;
        const updatedStudents = cls.students.map((s) => {
          const entry = photoMap.get(s.id);
          if (!entry) return s;
          clsUpdated = true;
          updatedCount++;
          return {
            ...s,
            photo: entry.url,
            photoSha256: entry.sha256,
            photoManualLink: true,
            updatedAtMs: now
          };
        });
        if (!clsUpdated) return cls;
        const updatedCls = { ...cls, updatedAtMs: now, students: updatedStudents };
        changedClasses.push(updatedCls);
        return updatedCls;
      });
      const savedState = writeSharedState({ classes: current.classes, classesUpdatedAtMs: now });
      if (changedClasses.length > 0) {
        broadcastRealtimeEvent(
          "classes:updated",
          {
            classes: changedClasses,
            classesUpdatedAtMs: savedState.classesUpdatedAtMs || now
          },
          originClientId
        );
      }
    }
    const results = Array.from(photoMap.entries()).map(([studentId, info]) => ({
      studentId,
      photoUrl: info.url,
      sha256: info.sha256
    }));
    return { updatedCount, skippedCount, results };
  };
  app.post(
    "/api/photos/upload-binary",
    requireInstitutionalAuth,
    express.raw({ type: "application/octet-stream", limit: "10mb" }),
    (req, res) => {
      const validation = validatePhotoUploadBinaryHeaders(
        req.headers["x-student-id"],
        req.headers["x-file-sha256"],
        req.body
      );
      if (!validation.ok) {
        res.status(400).json({ error: validation.error });
        return;
      }
      const { studentId, sha256 } = validation.data;
      const reqUser = extractRequestUser(req);
      const currentState = readSharedState();
      if (!reqUser.isAdmin && reqUser.role !== "usuario") {
        res.status(403).json({
          error: "Perfil somente leitura n\xE3o pode enviar ou substituir fotos.",
          code: "READ_ONLY_ROLE_FORBIDDEN"
        });
        return;
      }
      if (!canUserAccessOrMutateStudent(currentState, reqUser, studentId, "write")) {
        recordSecurityAuditLog(
          "CLASS_OWNERSHIP_VIOLATION_BLOCKED",
          `Docente ${reqUser.email} tentou enviar foto para estudante fora da sua turma (${studentId}).`,
          req,
          "BLOCKED",
          reqUser
        );
        res.status(403).json({
          error: "Voc\xEA s\xF3 pode enviar fotos de estudantes da sua pr\xF3pria turma atribu\xEDda.",
          code: "CLASS_OWNERSHIP_FORBIDDEN"
        });
        return;
      }
      const buffer = req.body;
      try {
        const result = applyPhotoBatchToState(
          [
            {
              studentId,
              buffer,
              sha256
            }
          ],
          getRequestClientId(req)
        );
        const item = result.results[0];
        const current = readSharedState();
        let resolvedUrl = item?.photoUrl;
        if (!resolvedUrl && Array.isArray(current.classes)) {
          for (const cls of current.classes) {
            const st = cls.students?.find((s) => s.id === studentId);
            if (st?.photo) {
              resolvedUrl = st.photo;
              break;
            }
          }
        }
        res.json({
          ok: true,
          photoUrl: resolvedUrl,
          sha256: item?.sha256,
          skipped: result.skippedCount > 0
        });
      } catch (err) {
        res.status(400).json({ error: err.message || "Falha ao salvar foto bin\xE1ria" });
      }
    }
  );
  app.post("/api/photos/upload", requireInstitutionalAuth, (req, res) => {
    const validation = validatePhotoUploadPayload(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { studentId, photoDataUrl } = validation.data;
    const reqUser = extractRequestUser(req);
    const current = readSharedState();
    if (!reqUser.isAdmin && reqUser.role !== "usuario") {
      res.status(403).json({
        error: "Perfil somente leitura n\xE3o pode enviar ou substituir fotos.",
        code: "READ_ONLY_ROLE_FORBIDDEN"
      });
      return;
    }
    if (!canUserAccessOrMutateStudent(current, reqUser, studentId, "write")) {
      recordSecurityAuditLog(
        "CLASS_OWNERSHIP_VIOLATION_BLOCKED",
        `Docente ${reqUser.email} tentou enviar foto para estudante fora da sua turma (${studentId}).`,
        req,
        "BLOCKED",
        reqUser
      );
      res.status(403).json({
        error: "Voc\xEA s\xF3 pode enviar fotos de estudantes da sua pr\xF3pria turma atribu\xEDda.",
        code: "CLASS_OWNERSHIP_FORBIDDEN"
      });
      return;
    }
    try {
      const saved = savePhotoDataUrlToFile(studentId, photoDataUrl);
      let updated = false;
      const now = Date.now();
      const changedClasses = [];
      if (Array.isArray(current.classes)) {
        current.classes = current.classes.map((cls) => {
          if (!Array.isArray(cls.students)) return cls;
          const has = cls.students.some((s) => s.id === studentId);
          if (!has) return cls;
          updated = true;
          const updatedCls = {
            ...cls,
            updatedAtMs: now,
            students: cls.students.map((s) => {
              if (s.id !== studentId) return s;
              return {
                ...s,
                photo: `${saved.photoUrl}?v=${now}`,
                photoSha256: saved.sha256,
                photoManualLink: true,
                updatedAtMs: now
              };
            })
          };
          changedClasses.push(updatedCls);
          return updatedCls;
        });
      }
      if (updated) {
        const savedState = writeSharedState({ classes: current.classes, classesUpdatedAtMs: now });
        if (changedClasses.length > 0) {
          broadcastRealtimeEvent(
            "classes:updated",
            {
              classes: changedClasses,
              classesUpdatedAtMs: savedState.classesUpdatedAtMs || now
            },
            getRequestClientId(req)
          );
        }
      }
      res.json({ ok: true, photoUrl: `${saved.photoUrl}?v=${now}`, sha256: saved.sha256 });
    } catch (err) {
      res.status(400).json({ error: err.message || "Falha ao salvar foto" });
    }
  });
  app.post(
    "/api/photos/batch-binary",
    requireAdminAuth,
    express.raw({ type: "application/octet-stream", limit: "30mb" }),
    (req, res) => {
      try {
        const items = decodeBinaryUploadPacket(req.body);
        if (items.length === 0) {
          res.status(400).json({ error: "Nenhuma foto no pacote bin\xE1rio." });
          return;
        }
        const result = applyPhotoBatchToState(items, getRequestClientId(req));
        res.json({ ok: true, ...result });
      } catch (err) {
        res.status(400).json({ error: err.message || "Falha ao processar lote bin\xE1rio de fotos" });
      }
    }
  );
  app.post("/api/photos/batch", requireAdminAuth, (req, res) => {
    const validation = validatePhotoBatchPayload(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { photos } = validation.data;
    try {
      const items = photos.map((item) => {
        const matches = item.photoDataUrl.match(/^data:([A-Za-z0-9\-+\/]+);base64,(.+)$/);
        const buffer = matches && matches.length === 3 ? Buffer.from(matches[2], "base64") : Buffer.from(item.photoDataUrl);
        return {
          studentId: item.studentId,
          buffer,
          sha256: item.sha256
        };
      });
      const result = applyPhotoBatchToState(items, getRequestClientId(req));
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message || "Falha ao processar lote de fotos" });
    }
  });
  app.post("/api/photos/verify-batch", requireInstitutionalAuth, (req, res) => {
    const safetyCheck = ensureSafePayloadObject(req.body ?? {});
    if (!safetyCheck.ok) {
      res.status(400).json({ error: safetyCheck.error });
      return;
    }
    const rawList = req.body?.filenames;
    if (!Array.isArray(rawList)) {
      res.status(400).json({ error: "Lista de nomes de arquivos inv\xE1lida." });
      return;
    }
    if (rawList.length > 500) {
      res.status(400).json({ error: "Limite m\xE1ximo de 500 verifica\xE7\xF5es por lote excedido." });
      return;
    }
    const reqUser = extractRequestUser(req);
    const state = readSharedState();
    const resolvedPhotosRoot = path.resolve(PHOTOS_DIR) + path.sep;
    const results = {};
    for (const item of rawList) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim();
      const withoutQuery = trimmed.split("?")[0].split("#")[0];
      const filename = path.basename(withoutQuery);
      if (!filename || filename === "." || filename === ".." || withoutQuery.includes("..")) {
        results[trimmed] = { accessible: false, reason: "invalid_name" };
        continue;
      }
      if (!canUserAccessOrMutateStudent(state, reqUser, filename, "read_photo")) {
        results[trimmed] = { accessible: false, reason: "missing" };
        continue;
      }
      let filePath = path.resolve(PHOTOS_DIR, filename);
      if (!filePath.startsWith(resolvedPhotosRoot)) {
        results[trimmed] = { accessible: false, reason: "invalid_name" };
        continue;
      }
      if (!fs.existsSync(filePath)) {
        const stem = filename.replace(/\.[^/.]+$/, "");
        for (const fallbackExt of [".webp", ".jpg", ".jpeg", ".png"]) {
          const altPath = path.resolve(PHOTOS_DIR, `${stem}${fallbackExt}`);
          if (altPath.startsWith(resolvedPhotosRoot) && fs.existsSync(altPath)) {
            filePath = altPath;
            break;
          }
        }
      }
      if (!fs.existsSync(filePath)) {
        results[trimmed] = { accessible: false, reason: "missing" };
        continue;
      }
      try {
        const stats = fs.statSync(filePath);
        if (!stats.isFile() || stats.size <= 0) {
          results[trimmed] = { accessible: false, reason: "empty" };
          continue;
        }
        results[trimmed] = { accessible: true, sizeBytes: stats.size };
      } catch {
        results[trimmed] = { accessible: false, reason: "missing" };
      }
    }
    res.json({ ok: true, results });
  });
  app.post("/api/photos/clear-all", requireAdminAuth, (req, res) => {
    const safetyCheck = ensureSafePayloadObject(req.body ?? {});
    if (!safetyCheck.ok) {
      res.status(400).json({ error: safetyCheck.error });
      return;
    }
    try {
      if (fs.existsSync(PHOTOS_DIR)) {
        const files = fs.readdirSync(PHOTOS_DIR);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(PHOTOS_DIR, file));
          } catch {
          }
        }
      }
      const current = readSharedState();
      let clearedCount = 0;
      const now = Date.now();
      if (Array.isArray(current.classes)) {
        current.classes = current.classes.map((cls) => {
          if (!Array.isArray(cls.students)) return cls;
          return {
            ...cls,
            updatedAtMs: now,
            students: cls.students.map((s) => {
              if (s.photo || s.photoDriveId || s.photoDriveUrl || s.photoSha256) clearedCount++;
              return {
                ...s,
                photo: "",
                photoDriveId: "",
                photoDriveUrl: "",
                photoSha256: "",
                photoManualLink: false,
                updatedAtMs: now
              };
            })
          };
        });
      }
      const savedState = writeSharedState({
        classes: current.classes,
        classesUpdatedAtMs: now,
        discoveredDrivePhotos: []
      });
      broadcastRealtimeEvent(
        "classes:replaced",
        {
          classes: savedState.classes || [],
          classesUpdatedAtMs: savedState.classesUpdatedAtMs || now,
          discoveredDrivePhotos: []
        },
        getRequestClientId(req)
      );
      res.json({ ok: true, clearedCount });
    } catch (err) {
      res.status(500).json({ error: err.message || "Falha ao limpar fotos" });
    }
  });
  const PDFS_DIR = path.join(DATA_DIR, "emeb_candelario_student_pdfs_v1");
  if (!fs.existsSync(PDFS_DIR)) {
    try {
      fs.mkdirSync(PDFS_DIR, { recursive: true });
    } catch {
    }
  }
  app.get("/api/pdfs/:filename", requireInstitutionalAuth, (req, res) => {
    const filename = path.basename(req.params.filename || "");
    if (!filename || filename === "." || filename === ".." || String(req.params.filename || "").includes("..")) {
      res.status(400).end();
      return;
    }
    const reqUser = extractRequestUser(req);
    const state = readSharedState();
    if (!canUserAccessOrMutateStudent(state, reqUser, filename, "read_pdf")) {
      recordSecurityAuditLog(
        "LGPD_DOCUMENT_ACCESS_BLOCKED",
        `Acesso bloqueado ao PDF "${filename}" para perfil ${reqUser.role} (${reqUser.email}).`,
        req,
        "BLOCKED",
        reqUser
      );
      res.status(403).json({
        error: "Acesso negado \xE0 ficha cadastral em PDF deste estudante.",
        code: "PDF_ACCESS_FORBIDDEN"
      });
      return;
    }
    const resolvedPdfsRoot = path.resolve(PDFS_DIR) + path.sep;
    const filePath = path.resolve(PDFS_DIR, filename);
    if (!filePath.startsWith(resolvedPdfsRoot)) {
      res.status(400).end();
      return;
    }
    if (!fs.existsSync(filePath)) {
      res.status(404).end();
      return;
    }
    const safeDispositionName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeDispositionName}"`);
    res.setHeader("Cache-Control", "private, max-age=86400");
    fs.createReadStream(filePath).pipe(res);
  });
  const savePdfBufferToFile = (studentId, buffer) => {
    if (!hasPdfSignatureInBuffer(buffer)) {
      throw new Error(`Arquivo PDF inv\xE1lido ou corrompido (sem cabe\xE7alho %PDF-) para ${studentId}.`);
    }
    const cleanId = String(studentId).replace(/[^a-zA-Z0-9-_]/g, "_");
    const filename = `${cleanId}.pdf`;
    const filePath = path.join(PDFS_DIR, filename);
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    let needsWrite = true;
    if (fs.existsSync(filePath)) {
      try {
        const existingBuf = fs.readFileSync(filePath);
        const existingSha = crypto.createHash("sha256").update(existingBuf).digest("hex");
        if (existingSha === sha256) {
          needsWrite = false;
        }
      } catch {
        needsWrite = true;
      }
    }
    if (needsWrite) {
      fs.writeFileSync(filePath, buffer);
    }
    return {
      pdfUrl: `/api/pdfs/${filename}`,
      pdfId: cleanId,
      sha256
    };
  };
  const decodePdfBufferFromDataUrl = (dataUrlOrBase64) => {
    const matches = dataUrlOrBase64.match(/^data:([A-Za-z0-9\-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      return Buffer.from(matches[2], "base64");
    }
    if (dataUrlOrBase64.startsWith("JVBERi0")) {
      return Buffer.from(dataUrlOrBase64, "base64");
    }
    return Buffer.from(dataUrlOrBase64);
  };
  const applyPdfBatchToState = (items, originClientId) => {
    const current = readSharedState();
    const existingStudentShaMap = /* @__PURE__ */ new Map();
    if (Array.isArray(current.classes)) {
      for (const cls of current.classes) {
        if (!Array.isArray(cls.students)) continue;
        for (const s of cls.students) {
          if (s?.id) {
            existingStudentShaMap.set(s.id, {
              sha256: s.fichaPdfSha256,
              pdfUrl: s.fichaPdfDriveUrl
            });
          }
        }
      }
    }
    const now = Date.now();
    const pdfMap = /* @__PURE__ */ new Map();
    let skippedCount = 0;
    for (const item of items) {
      if (!item.studentId || !item.buffer || item.buffer.length === 0) continue;
      const incomingSha = item.sha256 || crypto.createHash("sha256").update(item.buffer).digest("hex");
      const cleanId = String(item.studentId).replace(/[^a-zA-Z0-9-_]/g, "_");
      const existingInfo = existingStudentShaMap.get(item.studentId);
      if (existingInfo?.sha256 && existingInfo.sha256 === incomingSha && existingInfo.pdfUrl && fs.existsSync(path.join(PDFS_DIR, `${cleanId}.pdf`))) {
        skippedCount++;
        continue;
      }
      const saved = savePdfBufferToFile(item.studentId, item.buffer);
      pdfMap.set(item.studentId, {
        url: `${saved.pdfUrl}?v=${now}`,
        id: saved.pdfId,
        sha256: saved.sha256
      });
    }
    let updatedCount = 0;
    const changedClasses = [];
    if (pdfMap.size > 0 && Array.isArray(current.classes)) {
      current.classes = current.classes.map((cls) => {
        if (!Array.isArray(cls.students)) return cls;
        let clsUpdated = false;
        const updatedStudents = cls.students.map((s) => {
          const entry = pdfMap.get(s.id);
          if (!entry) return s;
          clsUpdated = true;
          updatedCount++;
          return {
            ...s,
            fichaPdfDriveUrl: entry.url,
            fichaPdfDriveId: entry.id,
            fichaPdfSha256: entry.sha256,
            fichaPdfManualLink: true,
            updatedAtMs: now
          };
        });
        if (!clsUpdated) return cls;
        const updatedCls = { ...cls, updatedAtMs: now, students: updatedStudents };
        changedClasses.push(updatedCls);
        return updatedCls;
      });
      const savedState = writeSharedState({ classes: current.classes, classesUpdatedAtMs: now });
      if (changedClasses.length > 0) {
        broadcastRealtimeEvent(
          "classes:updated",
          {
            classes: changedClasses,
            classesUpdatedAtMs: savedState.classesUpdatedAtMs || now
          },
          originClientId
        );
      }
    }
    const results = Array.from(pdfMap.entries()).map(([studentId, info]) => ({
      studentId,
      pdfUrl: info.url,
      pdfId: info.id,
      sha256: info.sha256
    }));
    return { updatedCount, skippedCount, results };
  };
  app.post("/api/pdfs/upload", requireInstitutionalAuth, (req, res) => {
    const validation = validatePdfUploadPayload(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { studentId, pdfDataUrl } = validation.data;
    const reqUser = extractRequestUser(req);
    const current = readSharedState();
    if (!reqUser.isAdmin && reqUser.role !== "usuario") {
      res.status(403).json({
        error: "Perfil somente leitura n\xE3o pode enviar fichas PDF.",
        code: "READ_ONLY_ROLE_FORBIDDEN"
      });
      return;
    }
    if (!canUserAccessOrMutateStudent(current, reqUser, studentId, "write")) {
      recordSecurityAuditLog(
        "CLASS_OWNERSHIP_VIOLATION_BLOCKED",
        `Docente ${reqUser.email} tentou enviar PDF para estudante fora da sua turma (${studentId}).`,
        req,
        "BLOCKED",
        reqUser
      );
      res.status(403).json({
        error: "Voc\xEA s\xF3 pode enviar fichas de estudantes da sua pr\xF3pria turma atribu\xEDda.",
        code: "CLASS_OWNERSHIP_FORBIDDEN"
      });
      return;
    }
    try {
      const buffer = decodePdfBufferFromDataUrl(pdfDataUrl);
      const result = applyPdfBatchToState([{ studentId, buffer }], getRequestClientId(req));
      const entry = result.results[0];
      res.json({
        ok: true,
        pdfUrl: entry?.pdfUrl,
        sha256: entry?.sha256,
        skipped: result.skippedCount > 0
      });
    } catch (err) {
      res.status(400).json({ error: err.message || "Falha ao salvar PDF" });
    }
  });
  app.post(
    "/api/pdfs/batch-binary",
    requireAdminAuth,
    express.raw({ type: "application/octet-stream", limit: "30mb" }),
    (req, res) => {
      try {
        const items = decodeBinaryUploadPacket(req.body);
        if (items.length === 0) {
          res.status(400).json({ error: "Nenhum PDF no pacote bin\xE1rio." });
          return;
        }
        const result = applyPdfBatchToState(items, getRequestClientId(req));
        res.json({ ok: true, ...result });
      } catch (err) {
        res.status(400).json({ error: err.message || "Falha ao processar lote bin\xE1rio de PDFs" });
      }
    }
  );
  app.post("/api/pdfs/batch", requireAdminAuth, (req, res) => {
    const validation = validatePdfBatchPayload(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { pdfs } = validation.data;
    try {
      const items = pdfs.map((item) => ({
        studentId: item.studentId,
        buffer: decodePdfBufferFromDataUrl(item.pdfDataUrl),
        sha256: item.sha256
      }));
      const result = applyPdfBatchToState(items, getRequestClientId(req));
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message || "Falha ao processar lote de PDFs" });
    }
  });
  app.post("/api/pdfs/clear-all", requireAdminAuth, (req, res) => {
    const safetyCheck = ensureSafePayloadObject(req.body ?? {});
    if (!safetyCheck.ok) {
      res.status(400).json({ error: safetyCheck.error });
      return;
    }
    try {
      if (fs.existsSync(PDFS_DIR)) {
        const files = fs.readdirSync(PDFS_DIR);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(PDFS_DIR, file));
          } catch {
          }
        }
      }
      const current = readSharedState();
      let clearedCount = 0;
      const now = Date.now();
      if (Array.isArray(current.classes)) {
        current.classes = current.classes.map((cls) => {
          if (!Array.isArray(cls.students)) return cls;
          return {
            ...cls,
            updatedAtMs: now,
            students: cls.students.map((s) => {
              if (s.fichaPdfDriveUrl || s.fichaPdfDriveId || s.fichaPdfSha256) clearedCount++;
              return {
                ...s,
                fichaPdfDriveId: "",
                fichaPdfDriveUrl: "",
                fichaPdfSubfolder: "",
                fichaPdfSha256: "",
                fichaPdfManualLink: false,
                updatedAtMs: now
              };
            })
          };
        });
      }
      const savedState = writeSharedState({
        classes: current.classes,
        classesUpdatedAtMs: now
      });
      broadcastRealtimeEvent(
        "classes:replaced",
        {
          classes: savedState.classes || [],
          classesUpdatedAtMs: savedState.classesUpdatedAtMs || now
        },
        getRequestClientId(req)
      );
      res.json({ ok: true, clearedCount });
    } catch (err) {
      res.status(500).json({ error: err.message || "Falha ao limpar PDFs" });
    }
  });
  const drivePhotoBufferCache = /* @__PURE__ */ new Map();
  app.get("/api/drive-photo/:fileId", requireInstitutionalAuth, async (req, res) => {
    const fileId = String(req.params.fileId || "").replace(/[^a-zA-Z0-9-_]/g, "");
    if (!fileId) {
      res.status(400).end();
      return;
    }
    const cached = drivePhotoBufferCache.get(fileId);
    if (cached && Date.now() - cached.cachedAt < 1e3 * 60 * 60 * 6) {
      res.setHeader("Content-Type", cached.contentType);
      res.setHeader("Cache-Control", "private, max-age=86400");
      res.send(cached.buffer);
      return;
    }
    const secrets = readServerSecrets();
    const token = secrets.adminDriveToken;
    if (token) {
      try {
        const mediaRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
            fileId
          )}?alt=media&supportsAllDrives=true`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        if (mediaRes.status === 401) {
          writeServerSecrets({ adminDriveToken: "", adminDriveTokenUpdatedAtMs: 0 });
        } else if (mediaRes.ok) {
          const contentType = mediaRes.headers.get("content-type") || "image/jpeg";
          if (contentType.startsWith("image/") || contentType.includes("octet-stream")) {
            const arrayBuffer = await mediaRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            if (buffer.length > 100) {
              const finalType = contentType.startsWith("image/") ? contentType : "image/jpeg";
              if (drivePhotoBufferCache.size > 600) {
                const oldestKey = drivePhotoBufferCache.keys().next().value;
                if (oldestKey) drivePhotoBufferCache.delete(oldestKey);
              }
              drivePhotoBufferCache.set(fileId, {
                buffer,
                contentType: finalType,
                cachedAt: Date.now()
              });
              res.setHeader("Content-Type", finalType);
              res.setHeader("Cache-Control", "private, max-age=86400");
              res.send(buffer);
              return;
            }
          }
        }
      } catch {
      }
    }
    const fallbackUrls = [
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`,
      `https://lh3.googleusercontent.com/d/${fileId}=w500`
    ];
    for (const url of fallbackUrls) {
      try {
        const pubRes = await fetch(url);
        const contentType = pubRes.headers.get("content-type") || "";
        if (pubRes.ok && contentType.startsWith("image/")) {
          const arrayBuffer = await pubRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          if (buffer.length > 100) {
            drivePhotoBufferCache.set(fileId, {
              buffer,
              contentType,
              cachedAt: Date.now()
            });
            res.setHeader("Content-Type", contentType);
            res.setHeader("Cache-Control", "private, max-age=86400");
            res.send(buffer);
            return;
          }
        }
      } catch {
      }
    }
    res.status(404).end();
  });
  app.post("/api/school-state/classes", requireInstitutionalAuth, requireCurrentCleanEpoch, (req, res) => {
    const validation = validateSchoolStateClassesPayload(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const {
      classes,
      classesUpdatedAtMs,
      discoveredNominalPdfs,
      discoveredDrivePhotos,
      cloudLinks,
      opId
    } = validation.data;
    const user = extractRequestUser(req);
    if (!user.isAdmin && user.role !== "usuario") {
      recordSecurityAuditLog(
        "PRIVILEGE_ESCALATION_BLOCKED",
        `Tentativa de altera\xE7\xE3o de turmas bloqueada para perfil somente leitura (${user.role}) de ${user.email}.`,
        req,
        "BLOCKED",
        user
      );
      res.status(403).json({
        error: "Seu perfil possui acesso somente de visualiza\xE7\xE3o e n\xE3o pode modificar turmas ou frequ\xEAncia.",
        code: "READ_ONLY_ROLE_FORBIDDEN"
      });
      return;
    }
    const current = readSharedState();
    const incTime = classesUpdatedAtMs || Date.now();
    const existingClassesMap = /* @__PURE__ */ new Map();
    if (Array.isArray(current.classes)) {
      current.classes.forEach((c) => {
        if (c && c.id) existingClassesMap.set(String(c.id).toLowerCase(), c);
      });
    }
    const allowedTeacherClassIds = /* @__PURE__ */ new Set();
    if (!user.isAdmin) {
      const matchedUser = (current.authorizedUsers || []).find(
        (u) => u && typeof u.email === "string" && u.email.trim().toLowerCase() === user.email
      );
      if (matchedUser?.assignedClassId && matchedUser.assignedClassId !== "all") {
        allowedTeacherClassIds.add(String(matchedUser.assignedClassId).toLowerCase());
      }
      if (Array.isArray(matchedUser?.assignedClassIds)) {
        matchedUser.assignedClassIds.forEach((id) => {
          if (id && id !== "all") allowedTeacherClassIds.add(String(id).toLowerCase());
        });
      }
      (current.classes || []).forEach((c) => {
        if (!c?.id) return;
        const primary = String(c.teacherEmail || "").trim().toLowerCase();
        const extraMatch = Array.isArray(c.authorizedTeacherEmails) && c.authorizedTeacherEmails.some(
          (e) => typeof e === "string" && e.trim().toLowerCase() === user.email
        );
        if (primary === user.email || extraMatch) {
          allowedTeacherClassIds.add(String(c.id).toLowerCase());
        }
      });
      const hasAnyOwnedClassInPayload = classes.some(
        (cls) => allowedTeacherClassIds.has(String(cls?.id || "").toLowerCase())
      );
      if (!hasAnyOwnedClassInPayload) {
        recordSecurityAuditLog(
          "CLASS_OWNERSHIP_VIOLATION_BLOCKED",
          `Docente ${user.email} tentou modificar turma(s) n\xE3o atribu\xEDda(s) ao seu perfil.`,
          req,
          "BLOCKED",
          user
        );
        res.status(403).json({
          error: "Voc\xEA s\xF3 possui permiss\xE3o para salvar altera\xE7\xF5es na(s) turma(s) vinculada(s) ao seu perfil.",
          code: "CLASS_OWNERSHIP_FORBIDDEN"
        });
        return;
      }
    }
    const compactClasses = classes.map((cls) => {
      const classIdLower = String(cls?.id || "").toLowerCase();
      const existingCls = existingClassesMap.get(classIdLower);
      if (!user.isAdmin && !allowedTeacherClassIds.has(classIdLower)) {
        return existingCls || cls;
      }
      const clsIncTime = cls?.updatedAtMs || incTime;
      const clsExtTime = existingCls?.updatedAtMs || 0;
      if (existingCls && clsExtTime > clsIncTime) {
        return existingCls;
      }
      const existingStudentsMap = /* @__PURE__ */ new Map();
      if (existingCls && Array.isArray(existingCls.students)) {
        existingCls.students.forEach((s) => {
          if (s && s.id) existingStudentsMap.set(String(s.id), s);
        });
      }
      let mergedStudents = Array.isArray(cls.students) ? cls.students.map((st) => {
        const extSt = existingStudentsMap.get(String(st?.id || ""));
        const stIncTime = st?.updatedAtMs || 0;
        const stExtTime = extSt?.updatedAtMs || 0;
        const baseSt = extSt && stExtTime > stIncTime ? extSt : st;
        const diasLetivosRecorte = Math.max(0, Math.min(31, Number(baseSt.diasLetivosRecorte ?? 20)));
        const totalAbsencesMonth = Math.max(0, Math.min(diasLetivosRecorte, Number(baseSt.totalAbsencesMonth ?? 0)));
        const justifiedAbsences = Math.max(0, Math.min(totalAbsencesMonth, Number(baseSt.justifiedAbsences ?? 0)));
        const preserveManualPhoto = extSt?.photoManualLink && !st?.photoManualLink && stIncTime < stExtTime;
        const preserveManualPdf = extSt?.fichaPdfManualLink && !st?.fichaPdfManualLink && stIncTime < stExtTime;
        const finalPhotoRaw = preserveManualPhoto ? extSt.photo : baseSt.photo;
        const finalPhotoDriveUrl = preserveManualPhoto ? extSt.photoDriveUrl : baseSt.photoDriveUrl || extSt?.photoDriveUrl;
        const preserveServerPii = !user.isAdmin && Boolean(extSt);
        const isMaskedString = (v) => typeof v === "string" && v.includes("***");
        const preservedPhones = preserveServerPii && isMaskedString(baseSt.telefones) ? extSt.telefones : baseSt.telefones;
        const preservedGuardianPhone = preserveServerPii && isMaskedString(baseSt.guardianPhone) ? extSt.guardianPhone : baseSt.guardianPhone;
        return {
          ...baseSt,
          ...preserveServerPii ? {
            cpf: extSt.cpf,
            rg: extSt.rg,
            dataEmissaoRg: extSt.dataEmissaoRg,
            nis: extSt.nis,
            cartaoSus: extSt.cartaoSus,
            cep: extSt.cep,
            logradouro: extSt.logradouro,
            numeroResidencia: extSt.numeroResidencia,
            complemento: extSt.complemento,
            telefones: preservedPhones,
            guardianPhone: preservedGuardianPhone
          } : {},
          diasLetivosRecorte,
          totalAbsencesMonth,
          justifiedAbsences,
          isDeleted: Boolean(baseSt.isDeleted),
          photoDriveId: preserveManualPhoto ? extSt.photoDriveId : baseSt.photoDriveId || extSt?.photoDriveId,
          photoDriveUrl: finalPhotoDriveUrl,
          photoManualLink: Boolean(
            preserveManualPhoto ? extSt.photoManualLink : baseSt.photoManualLink
          ),
          fichaPdfDriveId: preserveManualPdf ? extSt.fichaPdfDriveId : baseSt.fichaPdfDriveId || extSt?.fichaPdfDriveId,
          fichaPdfDriveUrl: preserveManualPdf ? extSt.fichaPdfDriveUrl : baseSt.fichaPdfDriveUrl || extSt?.fichaPdfDriveUrl,
          fichaPdfSubfolder: preserveManualPdf ? extSt.fichaPdfSubfolder : baseSt.fichaPdfSubfolder || extSt?.fichaPdfSubfolder,
          fichaPdfManualLink: Boolean(
            preserveManualPdf ? extSt.fichaPdfManualLink : baseSt.fichaPdfManualLink
          ),
          photo: finalPhotoRaw && typeof finalPhotoRaw === "string" && finalPhotoRaw.startsWith("data:image") && finalPhotoRaw.length > 35e3 && finalPhotoDriveUrl ? finalPhotoDriveUrl : finalPhotoRaw
        };
      }) : [];
      if (!user.isAdmin && Array.isArray(existingCls?.students) && existingCls.students.length > 0 && mergedStudents.length === 0) {
        mergedStudents = existingCls.students;
      }
      return {
        ...cls,
        teacherEmail: user.isAdmin ? cls.teacherEmail : existingCls?.teacherEmail || cls.teacherEmail,
        authorizedTeacherEmails: user.isAdmin ? cls.authorizedTeacherEmails : existingCls?.authorizedTeacherEmails,
        version: (cls.version || existingCls?.version || 1) + 1,
        updatedAtMs: Math.max(clsIncTime, clsExtTime),
        students: mergedStudents
      };
    });
    const mergedByIdLower = new Map(existingClassesMap);
    compactClasses.forEach((cls) => {
      if (cls && cls.id) {
        mergedByIdLower.set(String(cls.id).toLowerCase(), cls);
      }
    });
    const mergedFullClasses = [];
    const seenMergedIds = /* @__PURE__ */ new Set();
    (Array.isArray(current.classes) ? current.classes : []).forEach((orig) => {
      const k = String(orig?.id || "").toLowerCase();
      if (!k || seenMergedIds.has(k)) return;
      seenMergedIds.add(k);
      mergedFullClasses.push(mergedByIdLower.get(k) || orig);
    });
    compactClasses.forEach((cls) => {
      const k = String(cls?.id || "").toLowerCase();
      if (!k || seenMergedIds.has(k)) return;
      seenMergedIds.add(k);
      mergedFullClasses.push(cls);
    });
    const patch = {
      classes: mergedFullClasses,
      classesUpdatedAtMs: Math.max(incTime, current.classesUpdatedAtMs || 0)
    };
    if (Array.isArray(discoveredNominalPdfs) && discoveredNominalPdfs.length > 0) {
      patch.discoveredNominalPdfs = discoveredNominalPdfs;
    }
    if (Array.isArray(discoveredDrivePhotos) && discoveredDrivePhotos.length > 0) {
      patch.discoveredDrivePhotos = discoveredDrivePhotos;
    }
    if (user.isAdmin && cloudLinks && typeof cloudLinks === "object") {
      patch.cloudLinks = {
        ...current.cloudLinks || {},
        ...cloudLinks,
        updatedAtMs: Date.now()
      };
    }
    const saved = writeSharedState(patch);
    broadcastRealtimeEvent(
      "classes:updated",
      {
        classes: compactClasses,
        classesUpdatedAtMs: saved.classesUpdatedAtMs || incTime,
        ...patch.cloudLinks ? { cloudLinks: saved.cloudLinks } : {},
        ...patch.discoveredNominalPdfs ? { discoveredNominalPdfs: saved.discoveredNominalPdfs } : {},
        ...patch.discoveredDrivePhotos ? { discoveredDrivePhotos: saved.discoveredDrivePhotos } : {}
      },
      getRequestClientId(req)
    );
    recordSecurityAuditLog(
      "CLASSES_ATTENDANCE_SYNCED",
      `Sincroniza\xE7\xE3o at\xF4mica de ${compactClasses.length} turmas (${opId || "sem opId"}) confirmada com sucesso.`,
      req,
      "SUCCESS",
      user
    );
    res.json({ ok: true, classesUpdatedAtMs: saved.classesUpdatedAtMs, opId });
  });
  app.post("/api/school-state/links", requireAdminAuth, requireCurrentCleanEpoch, (req, res) => {
    const validation = validateSchoolStateLinksPayload(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { cloudLinks, discoveredNominalPdfs, discoveredDrivePhotos, genderDictionary } = validation.data;
    const current = readSharedState();
    const patch = {};
    if (cloudLinks && typeof cloudLinks === "object") {
      patch.cloudLinks = {
        ...current.cloudLinks || {},
        ...cloudLinks,
        updatedAtMs: Date.now()
      };
    }
    if (Array.isArray(discoveredNominalPdfs)) {
      patch.discoveredNominalPdfs = discoveredNominalPdfs;
    }
    if (Array.isArray(discoveredDrivePhotos) && discoveredDrivePhotos.length > 0) {
      patch.discoveredDrivePhotos = discoveredDrivePhotos;
    }
    if (Array.isArray(genderDictionary)) {
      patch.genderDictionary = genderDictionary;
    }
    const saved = writeSharedState(patch);
    broadcastRealtimeEvent(
      "meta:updated",
      {
        ...patch.cloudLinks ? { cloudLinks: saved.cloudLinks } : {},
        ...patch.discoveredNominalPdfs ? { discoveredNominalPdfs: saved.discoveredNominalPdfs } : {},
        ...patch.discoveredDrivePhotos ? { discoveredDrivePhotos: saved.discoveredDrivePhotos } : {},
        ...patch.genderDictionary ? { genderDictionary: saved.genderDictionary } : {}
      },
      getRequestClientId(req)
    );
    recordSecurityAuditLog(
      "CLOUD_LINKS_UPDATED",
      "Configura\xE7\xE3o de pastas na nuvem atualizada.",
      req
    );
    res.json(saved);
  });
  app.post("/api/school-state/users", requireAdminAuth, (req, res) => {
    const validation = validateSchoolStateUsersPayload(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { authorizedUsers } = validation.data;
    const current = readSharedState();
    const currentByEmail = /* @__PURE__ */ new Map();
    (current.authorizedUsers || []).forEach((u) => {
      if (u && typeof u.email === "string") {
        currentByEmail.set(u.email.trim().toLowerCase(), u);
      }
    });
    const mergedUsers = authorizedUsers.map((incoming) => {
      const email = String(incoming.email || "").trim().toLowerCase();
      const existing = currentByEmail.get(email);
      if (!existing) return incoming;
      const incTime = incoming.updatedAtMs || 0;
      const extTime = existing.updatedAtMs || 0;
      const winner = incTime >= extTime ? incoming : existing;
      return {
        ...winner,
        updatedAtMs: Math.max(incTime, extTime),
        totalAccessCount: Math.max(
          incoming.totalAccessCount || 0,
          existing.totalAccessCount || 0
        ),
        totalDurationSeconds: Math.max(
          incoming.totalDurationSeconds || 0,
          existing.totalDurationSeconds || 0
        ),
        lastSessionDurationSeconds: Math.max(
          incoming.lastSessionDurationSeconds || 0,
          existing.lastSessionDurationSeconds || 0
        ),
        lastLoginAt: incoming.lastLoginAt || existing.lastLoginAt,
        lastActiveAt: incoming.lastActiveAt || existing.lastActiveAt,
        lastScreenVisited: incoming.lastScreenVisited || existing.lastScreenVisited
      };
    });
    const saved = writeSharedState({ authorizedUsers: mergedUsers });
    const todayIso = getTodaySaoPauloIso();
    const revokedEmails = /* @__PURE__ */ new Set();
    mergedUsers.forEach((u) => {
      const email = String(u?.email || "").trim().toLowerCase();
      if (!email) return;
      const expired = typeof u.accessExpiresAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(u.accessExpiresAt.trim()) && todayIso > u.accessExpiresAt.trim();
      if (u.active === false || expired) {
        revokedEmails.add(email);
        revokeUserSessionsAfter(email, Date.now());
      }
    });
    if (revokedEmails.size > 0) {
      wsClients.forEach((client) => {
        if (client.user?.email && revokedEmails.has(client.user.email)) {
          try {
            client.ws.close(4403, "Acesso revogado pelo administrador");
          } catch {
          }
          wsClients.delete(client);
        }
      });
      sseClients.forEach((client) => {
        if (client.user?.email && revokedEmails.has(client.user.email)) {
          try {
            client.res.end();
          } catch {
          }
          sseClients.delete(client);
        }
      });
    }
    broadcastRealtimeEvent(
      "meta:updated",
      {
        authorizedUsers: saved.authorizedUsers || []
      },
      getRequestClientId(req)
    );
    res.json(saved);
  });
  app.post("/api/school-state/lgpd", requireAdminAuth, (req, res) => {
    const validation = validateLgpdConfigPayload(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const reqUser = extractRequestUser(req);
    const saved = writeSharedState({ lgpdConfig: validation.data.lgpdConfig });
    broadcastRealtimeEvent(
      "meta:updated",
      { lgpdConfig: saved.lgpdConfig },
      getRequestClientId(req)
    );
    recordSecurityAuditLog(
      "LGPD_CONFIG_UPDATED",
      `Pol\xEDtica LGPD atualizada por ${reqUser.email}: mascaramento=${saved.lgpdConfig?.maskSensitiveDataByDefault ? "ATIVO" : "DESATIVADO"}, anonimizar_export=${saved.lgpdConfig?.anonymizeExportedSpreadsheets ? "SIM" : "N\xC3O"}, auto_logout=${saved.lgpdConfig?.autoLogoutMinutes || 60}min.`,
      req,
      "SUCCESS",
      reqUser
    );
    res.json({ ok: true, lgpdConfig: saved.lgpdConfig });
  });
  const sanitizeTextSafe = (val) => {
    if (typeof val === "string") {
      return val.replace(/<(script|svg|iframe|object|embed)\b[^]*?(?:<\/\1>|\/\s*>)/gi, "").replace(/<\/?(script|svg|iframe|object|embed)\b[^>]*>/gi, "").replace(/\b(?:javascript|vbscript)\s*:/gi, "").replace(/\bdata\s*:\s*text\/html\b/gi, "").replace(/\son\w+\s*=/gi, "");
    }
    if (Array.isArray(val)) {
      return val.map(sanitizeTextSafe);
    }
    if (val && typeof val === "object") {
      const cleaned = {};
      for (const [k, v] of Object.entries(val)) {
        cleaned[k] = sanitizeTextSafe(v);
      }
      return cleaned;
    }
    return val;
  };
  app.post("/api/school-state/reset", requireAdminAuth, (req, res) => {
    const validation = validateSchoolStateResetPayload(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { freshClasses } = validation.data;
    const user = extractRequestUser(req);
    const nowMs = Date.now();
    for (const dirPath of [PHOTOS_DIR, PDFS_DIR]) {
      try {
        if (fs.existsSync(dirPath)) {
          for (const file of fs.readdirSync(dirPath)) {
            try {
              fs.unlinkSync(path.join(dirPath, file));
            } catch {
            }
          }
        }
      } catch {
      }
    }
    const current = readSharedState();
    const baseClasses = Array.isArray(freshClasses) && freshClasses.length > 0 ? freshClasses : current.classes || [];
    const targetClasses = baseClasses.map((c) => ({
      ...c,
      students: [],
      totalStudents: 0,
      monthlyAbsences: 0,
      presenceRate: 0,
      statusText: "Aguardando importa\xE7\xE3o de estudantes",
      isPending: false,
      weeklyPerformance: [],
      pedagogicalNotes: "",
      updatedAtMs: nowMs
    }));
    const cleanedUsers = Array.isArray(current.authorizedUsers) ? current.authorizedUsers.map((u) => ({
      ...u,
      totalAccessCount: 0,
      totalDurationSeconds: 0,
      lastSessionDurationSeconds: 0,
      lastLoginAt: void 0,
      lastActiveAt: void 0,
      lastScreenVisited: void 0
    })) : current.authorizedUsers;
    const savedReset = writeSharedState({
      cleanResetEpochId: SERVER_CLEAN_RESET_EPOCH_ID,
      classes: targetClasses,
      classesUpdatedAtMs: nowMs,
      authorizedUsers: cleanedUsers,
      accessSessionLogs: [],
      schoolNotices: [],
      securityAuditLogs: [],
      discoveredNominalPdfs: [],
      discoveredDrivePhotos: [],
      fcmAlerts: []
    });
    broadcastRealtimeEvent(
      "state:reset",
      {
        classes: savedReset.classes || targetClasses,
        classesUpdatedAtMs: nowMs,
        cleanResetEpochId: SERVER_CLEAN_RESET_EPOCH_ID
      },
      getRequestClientId(req)
    );
    res.json({ ok: true, classesUpdatedAtMs: nowMs, totalClasses: targetClasses.length, user: user.email });
  });
  app.post("/api/school-state/import-json", requireAdminAuth, requireCurrentCleanEpoch, (req, res) => {
    const validation = validateSchoolStateImportJsonPayload(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { payload, fileName, fileSize } = validation.data;
    let rawClasses = null;
    if (Array.isArray(payload)) {
      rawClasses = payload;
    } else if (payload && typeof payload === "object") {
      if (Array.isArray(payload.classes)) {
        rawClasses = payload.classes;
      } else if (Array.isArray(payload.turmas)) {
        rawClasses = payload.turmas;
      }
    }
    if (!rawClasses || !Array.isArray(rawClasses) || rawClasses.length === 0) {
      res.status(400).json({
        error: "Estrutura JSON inv\xE1lida. O arquivo precisa conter uma lista de turmas (classes ou turmas com estudantes)."
      });
      return;
    }
    const cleanedPayload = sanitizeTextSafe(rawClasses);
    const sanitizedClasses = sanitizeAndDeduplicateClasses(cleanedPayload) || [];
    const totalStudents = sanitizedClasses.reduce((acc, c) => acc + (c.students?.length || 0), 0);
    const nowMs = Date.now();
    const user = extractRequestUser(req);
    const patch = {
      classes: sanitizedClasses,
      classesUpdatedAtMs: nowMs
    };
    if (payload.officialCalendarConfig && typeof payload.officialCalendarConfig === "object") {
      patch.officialCalendarConfig = sanitizeTextSafe(payload.officialCalendarConfig);
    }
    if (Array.isArray(payload.holidays) && payload.holidays.length > 0) {
      patch.holidays = sanitizeTextSafe(payload.holidays);
    }
    const savedImport = writeSharedState(patch);
    broadcastRealtimeEvent(
      "classes:replaced",
      {
        classes: savedImport.classes || sanitizedClasses,
        classesUpdatedAtMs: savedImport.classesUpdatedAtMs || nowMs
      },
      getRequestClientId(req)
    );
    recordSecurityAuditLog(
      "JSON_DATA_IMPORT_APPLIED",
      `Base escolar atualizada com sucesso via arquivo JSON "${fileName || "upload.json"}" (${sanitizedClasses.length} turmas, ${totalStudents} estudantes, ${fileSize || "N/A"}) por ${user.email}`,
      req,
      "SUCCESS",
      user
    );
    res.json({
      ok: true,
      classesUpdatedAtMs: nowMs,
      totalClasses: sanitizedClasses.length,
      totalStudents,
      classes: sanitizedClasses
    });
  });
  app.post("/api/school-state/logs", requireInstitutionalAuth, requireCurrentCleanEpoch, (req, res) => {
    const validation = validateSchoolStateLogsPayload(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { accessSessionLogs, authorizedUsers } = validation.data;
    const current = readSharedState();
    const reqUser = extractRequestUser(req);
    const logMap = /* @__PURE__ */ new Map();
    (current.accessSessionLogs || []).forEach((l) => {
      if (l && l.id) logMap.set(l.id, l);
    });
    if (Array.isArray(accessSessionLogs)) {
      accessSessionLogs.forEach((l) => {
        if (!l || !l.id) return;
        const logEmail = String(l.email || "").trim().toLowerCase();
        if (!reqUser.isAdmin && logEmail !== reqUser.email) return;
        const prev = logMap.get(l.id);
        if (!prev || (l.durationSeconds || 0) >= (prev.durationSeconds || 0) || l.logoutTimeISO) {
          logMap.set(l.id, { ...l, ...logEmail ? { email: logEmail } : {} });
        }
      });
    }
    const mergedLogs = Array.from(logMap.values()).sort(
      (a, b) => new Date(b.loginTimeISO || 0).getTime() - new Date(a.loginTimeISO || 0).getTime()
    ).slice(0, 500);
    let nextUsers = current.authorizedUsers;
    if (Array.isArray(authorizedUsers)) {
      const currentByEmail = /* @__PURE__ */ new Map();
      (current.authorizedUsers || []).forEach((u) => {
        if (u && typeof u.email === "string") {
          currentByEmail.set(u.email.trim().toLowerCase(), u);
        }
      });
      nextUsers = authorizedUsers.map((incoming) => {
        const email = String(incoming.email || "").trim().toLowerCase();
        const existing = currentByEmail.get(email);
        if (!existing) {
          return reqUser.isAdmin ? incoming : null;
        }
        if (!reqUser.isAdmin && email !== reqUser.email) {
          return existing;
        }
        const incTime = incoming.updatedAtMs || 0;
        const extTime = existing.updatedAtMs || 0;
        const winner = reqUser.isAdmin && incTime >= extTime ? incoming : existing;
        return {
          ...winner,
          updatedAtMs: Math.max(incTime, extTime),
          totalAccessCount: Math.max(
            incoming.totalAccessCount || 0,
            existing.totalAccessCount || 0
          ),
          totalDurationSeconds: Math.max(
            incoming.totalDurationSeconds || 0,
            existing.totalDurationSeconds || 0
          ),
          lastSessionDurationSeconds: Math.max(
            incoming.lastSessionDurationSeconds || 0,
            existing.lastSessionDurationSeconds || 0
          ),
          lastLoginAt: incoming.lastLoginAt || existing.lastLoginAt,
          lastActiveAt: incoming.lastActiveAt || existing.lastActiveAt,
          lastScreenVisited: incoming.lastScreenVisited || existing.lastScreenVisited
        };
      }).filter(Boolean);
    }
    const saved = writeSharedState({
      accessSessionLogs: mergedLogs,
      ...nextUsers ? { authorizedUsers: nextUsers } : {}
    });
    broadcastRealtimeEvent(
      "meta:updated",
      {
        accessSessionLogs: saved.accessSessionLogs || [],
        ...saved.authorizedUsers ? { authorizedUsers: saved.authorizedUsers } : {}
      },
      getRequestClientId(req)
    );
    res.json(saved);
  });
  app.post("/api/school-state/window", requireAdminAuth, (req, res) => {
    const validation = validateAttendanceWindowPayload(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { attendanceWindowConfig } = validation.data;
    const saved = writeSharedState({ attendanceWindowConfig });
    broadcastRealtimeEvent(
      "meta:updated",
      {
        attendanceWindowConfig: saved.attendanceWindowConfig
      },
      getRequestClientId(req)
    );
    recordSecurityAuditLog(
      "ATTENDANCE_WINDOW_MODIFIED",
      `Janela de frequ\xEAncia alterada: ${attendanceWindowConfig.isOpen ? "ABERTA" : "FECHADA"} at\xE9 ${attendanceWindowConfig.closeDateISO || "N/A"}.`,
      req
    );
    void checkServerSideWindowClosingAlert();
    res.json(saved);
  });
  app.post("/api/school-state/notices", requireAdminAuth, requireCurrentCleanEpoch, (req, res) => {
    const validation = validateSchoolNoticesPayload(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { schoolNotices } = validation.data;
    const saved = writeSharedState({ schoolNotices: schoolNotices.slice(0, 60) });
    broadcastRealtimeEvent(
      "meta:updated",
      {
        schoolNotices: saved.schoolNotices || []
      },
      getRequestClientId(req)
    );
    recordSecurityAuditLog(
      "SCHOOL_NOTICES_UPDATED",
      `Quadro de avisos atualizado (${schoolNotices.length} avisos).`,
      req
    );
    res.json(saved);
  });
  app.post("/api/school-state/notices/read", requireInstitutionalAuth, requireCurrentCleanEpoch, (req, res) => {
    const base = ensureSafePayloadObject(req.body);
    if (!base.ok) {
      res.status(400).json({ error: base.error });
      return;
    }
    const rawIds = base.data.noticeIds;
    if (!Array.isArray(rawIds) || rawIds.length === 0 || rawIds.length > 60) {
      res.status(400).json({ error: "Lista noticeIds inv\xE1lida (informe de 1 a 60 IDs)." });
      return;
    }
    const cleanIds = rawIds.filter((id) => typeof id === "string" && id.trim().length > 0 && id.trim().length <= 128).map((id) => id.trim());
    if (cleanIds.length === 0) {
      res.status(400).json({ error: "Nenhum noticeId v\xE1lido informado." });
      return;
    }
    const reqUser = extractRequestUser(req);
    const idSet = new Set(cleanIds);
    const current = readSharedState();
    const notices = Array.isArray(current.schoolNotices) ? current.schoolNotices : [];
    const nowISO = (/* @__PURE__ */ new Date()).toISOString();
    let changed = false;
    const updatedNotices = notices.map((notice) => {
      if (!notice || !idSet.has(String(notice.id))) return notice;
      const existingReaders = Array.isArray(notice.readBy) ? notice.readBy : [];
      const alreadyRecorded = existingReaders.some(
        (r) => typeof r?.userEmail === "string" && r.userEmail.trim().toLowerCase() === reqUser.email
      );
      if (alreadyRecorded) return notice;
      changed = true;
      return {
        ...notice,
        readBy: [
          {
            userEmail: reqUser.email,
            userName: reqUser.name || reqUser.email,
            userRole: reqUser.role,
            readAtISO: nowISO
          },
          ...existingReaders
        ]
      };
    });
    const saved = changed ? writeSharedState({ schoolNotices: updatedNotices }) : current;
    if (changed) {
      broadcastRealtimeEvent(
        "meta:updated",
        {
          schoolNotices: saved.schoolNotices || []
        },
        getRequestClientId(req)
      );
    }
    res.json({ ok: true, schoolNotices: saved.schoolNotices || [] });
  });
  app.get("/api/calendar-config", requireInstitutionalAuth, (_req, res) => {
    const state = readSharedState();
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({
      calendarConfig: state.officialCalendarConfig,
      holidays: state.holidays || OFFICIAL_DEFAULT_HOLIDAYS_2027,
      auditLogs: (state.calendarAuditLogs || []).slice(0, 100),
      updatedAtMs: state.officialCalendarConfig?.updatedAtMs || Date.now()
    });
  });
  app.post("/api/calendar-config", requireAdminAuth, (req, res) => {
    const payloadCheck = validateCalendarConfigPayload(req.body);
    if (!payloadCheck.ok) {
      res.status(400).json({ error: payloadCheck.error });
      return;
    }
    const { rawDatesText, schoolDays, adminEmail, adminName, year } = payloadCheck.data;
    const current = readSharedState();
    const currentHolidays = current.holidays || OFFICIAL_DEFAULT_HOLIDAYS_2027;
    const textToValidate = typeof rawDatesText === "string" && rawDatesText.trim().length > 0 ? rawDatesText : Array.isArray(schoolDays) ? schoolDays.join("\n") : "";
    const validation = parseAndValidateSchoolDates(textToValidate, currentHolidays);
    if (validation.hasErrors) {
      res.status(400).json({
        error: "Erros de valida\xE7\xE3o encontrados no lote de datas informado.",
        invalidEntries: validation.invalidEntries,
        duplicateEntries: validation.duplicateEntries
      });
      return;
    }
    if (validation.totalCount !== 200) {
      res.status(400).json({
        error: `A meta oficial exige exatamente 200 dias letivos distintos. O lote enviado possui ${validation.totalCount} datas (${validation.remainingCount > 0 ? `faltam ${validation.remainingCount} dias` : `excedente de ${validation.exceededCount} dias`}).`,
        totalCount: validation.totalCount,
        remainingCount: validation.remainingCount,
        exceededCount: validation.exceededCount
      });
      return;
    }
    const reqUser = extractRequestUser(req);
    const newCalendarConfig = {
      year: Number(year) || 2027,
      schoolDays: validation.validDates,
      calendarDays: validation.calendarDays,
      monthlyDistribution: validation.monthlyDistribution,
      holidays: currentHolidays,
      updatedAtMs: Date.now(),
      updatedByEmail: reqUser.email || adminEmail || "emebjfreitas@jundiai.sp.gov.br",
      updatedByName: reqUser.name || adminName || "Administrador Escolar",
      version: (current.officialCalendarConfig?.version || 1) + 1
    };
    const auditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestampISO: (/* @__PURE__ */ new Date()).toISOString(),
      adminEmail: reqUser.email || adminEmail || "emebjfreitas@jundiai.sp.gov.br",
      adminName: reqUser.name || adminName || "Administrador Escolar",
      action: "UPDATE_200_DAYS",
      previousDaysCount: current.officialCalendarConfig?.schoolDays?.length || 200,
      newDaysCount: 200,
      holidaysCount: currentHolidays.length,
      details: `Configura\xE7\xE3o \xFAnica dos 200 dias letivos de ${year || 2027} homologada com sucesso via processamento centralizado.`,
      clientIp: req.ip
    };
    const auditLogs = [auditEntry, ...current.calendarAuditLogs || []].slice(0, 150);
    let updatedClasses = current.classes;
    if (Array.isArray(updatedClasses)) {
      updatedClasses = updatedClasses.map((cls) => ({
        ...cls,
        classesHeld: validation.monthlyDistribution["Outubro"] || cls.classesHeld || 20,
        monthlySchoolDays: {
          ...cls.monthlySchoolDays || {},
          ...validation.monthlyDistribution
        },
        updatedAtMs: Date.now()
      }));
    }
    const saved = writeSharedState({
      officialCalendarConfig: newCalendarConfig,
      calendarAuditLogs: auditLogs,
      ...updatedClasses ? { classes: updatedClasses, classesUpdatedAtMs: Date.now() } : {}
    });
    broadcastRealtimeEvent(
      "calendar:updated",
      {
        calendarConfig: saved.officialCalendarConfig,
        holidays: saved.holidays || currentHolidays,
        auditLogs: (saved.calendarAuditLogs || []).slice(0, 100),
        classesUpdatedAtMs: saved.classesUpdatedAtMs
      },
      getRequestClientId(req)
    );
    res.json({
      ok: true,
      calendarConfig: saved.officialCalendarConfig,
      auditEntry,
      monthlyDistribution: validation.monthlyDistribution
    });
  });
  app.post("/api/holidays", requireAdminAuth, (req, res) => {
    const validation = validateHolidayActionPayload(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { action, holiday, holidayId, adminEmail, adminName } = validation.data;
    const reqUser = extractRequestUser(req);
    const verifiedAdminEmail = reqUser.email || adminEmail || "emebjfreitas@jundiai.sp.gov.br";
    const verifiedAdminName = reqUser.name || adminName || "Administrador Escolar";
    const current = readSharedState();
    let holidaysList = Array.isArray(current.holidays) ? [...current.holidays] : [...OFFICIAL_DEFAULT_HOLIDAYS_2027];
    let auditDetail = "";
    if (action === "delete") {
      if (!holidayId) {
        res.status(400).json({ error: "holidayId n\xE3o informado para exclus\xE3o." });
        return;
      }
      const target = holidaysList.find((h) => h.id === holidayId);
      holidaysList = holidaysList.filter((h) => h.id !== holidayId);
      auditDetail = `Exclus\xE3o do feriado/recesso: "${target?.name || holidayId}" (${target?.date || ""}).`;
    } else if (action === "add") {
      if (!holiday || !holiday.date || !holiday.name) {
        res.status(400).json({ error: "Dados do feriado incompletos (data e nome s\xE3o obrigat\xF3rios)." });
        return;
      }
      const newHol = {
        id: `hol-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: String(holiday.date).trim(),
        name: String(holiday.name).trim(),
        type: holiday.type || "municipal",
        description: holiday.description || "",
        createdAtISO: (/* @__PURE__ */ new Date()).toISOString(),
        updatedByEmail: verifiedAdminEmail
      };
      holidaysList.push(newHol);
      auditDetail = `Cadastro de novo feriado/recesso: "${newHol.name}" em ${newHol.date} (${newHol.type}).`;
    } else if (action === "edit") {
      if (!holiday || !holiday.id) {
        res.status(400).json({ error: "Dados do feriado incompletos para edi\xE7\xE3o." });
        return;
      }
      holidaysList = holidaysList.map((h) => h.id === holiday.id ? { ...h, ...holiday } : h);
      auditDetail = `Edi\xE7\xE3o do feriado/recesso: "${holiday.name}" (${holiday.date}).`;
    } else if (action === "restore_defaults") {
      holidaysList = [...OFFICIAL_DEFAULT_HOLIDAYS_2027];
      auditDetail = "Restaura\xE7\xE3o da lista padr\xE3o de feriados e recessos oficiais de Jundia\xED/SP.";
    } else {
      res.status(400).json({ error: "A\xE7\xE3o de feriado inv\xE1lida." });
      return;
    }
    const auditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestampISO: (/* @__PURE__ */ new Date()).toISOString(),
      adminEmail: verifiedAdminEmail,
      adminName: verifiedAdminName,
      action: action === "delete" ? "DELETE_HOLIDAY" : action === "edit" ? "EDIT_HOLIDAY" : "ADD_HOLIDAY",
      previousDaysCount: current.officialCalendarConfig?.schoolDays?.length || 200,
      newDaysCount: current.officialCalendarConfig?.schoolDays?.length || 200,
      holidaysCount: holidaysList.length,
      details: auditDetail,
      clientIp: req.ip
    };
    const auditLogs = [auditEntry, ...current.calendarAuditLogs || []].slice(0, 150);
    const saved = writeSharedState({
      holidays: holidaysList,
      calendarAuditLogs: auditLogs
    });
    broadcastRealtimeEvent(
      "calendar:updated",
      {
        calendarConfig: saved.officialCalendarConfig,
        holidays: saved.holidays,
        auditLogs: (saved.calendarAuditLogs || []).slice(0, 100)
      },
      getRequestClientId(req)
    );
    res.json({
      ok: true,
      holidays: saved.holidays,
      auditEntry
    });
  });
  app.get("/api/calendar-audit-log", requireInstitutionalAuth, (_req, res) => {
    const state = readSharedState();
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({
      auditLogs: (state.calendarAuditLogs || []).slice(0, 150)
    });
  });
  app.get("/api/security-logs", requireAdminAuth, (_req, res) => {
    const state = readSharedState();
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({
      securityLogs: (state.securityAuditLogs || []).slice(0, 300),
      lgpdConfig: state.lgpdConfig || null
    });
  });
  app.post("/api/security-logs", requireInstitutionalAuth, (req, res) => {
    const validation = validateSecurityLogPayload(req.body);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }
    const entry = validation.data;
    const verifiedUser = extractRequestUser(req);
    const state = readSharedState();
    const existingLogs = Array.isArray(state.securityAuditLogs) ? state.securityAuditLogs : [];
    const clientIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1";
    const enrichedEntry = {
      ...entry,
      userEmail: verifiedUser.email,
      userRole: verifiedUser.role,
      id: entry.id || `sec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestampISO: entry.timestampISO || (/* @__PURE__ */ new Date()).toISOString(),
      clientIp
    };
    const nextLogs = [enrichedEntry, ...existingLogs].slice(0, 300);
    writeSharedState({ securityAuditLogs: nextLogs });
    res.json({ ok: true, entry: enrichedEntry });
  });
  let cachedFcmAccessToken = null;
  const ensureAutoWebPushVapidKeys = () => {
    const secrets = readServerSecrets();
    if (secrets.webPushVapidKeys?.publicKey && secrets.webPushVapidKeys?.privateKey) {
      const subject2 = secrets.webPushVapidKeys.subject || "mailto:emebjfreitas@jundiai.sp.gov.br";
      try {
        webpush.setVapidDetails(
          subject2,
          secrets.webPushVapidKeys.publicKey,
          secrets.webPushVapidKeys.privateKey
        );
      } catch {
      }
      return {
        publicKey: secrets.webPushVapidKeys.publicKey,
        privateKey: secrets.webPushVapidKeys.privateKey,
        subject: subject2
      };
    }
    const generated = webpush.generateVAPIDKeys();
    const subject = "mailto:emebjfreitas@jundiai.sp.gov.br";
    writeServerSecrets({
      webPushVapidKeys: {
        publicKey: generated.publicKey,
        privateKey: generated.privateKey,
        subject,
        createdAtISO: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    webpush.setVapidDetails(subject, generated.publicKey, generated.privateKey);
    return {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
      subject
    };
  };
  try {
    ensureAutoWebPushVapidKeys();
  } catch (err) {
    console.warn("Aviso ao inicializar VAPID Web Push autom\xE1tico:", err);
  }
  const parseFirebaseServiceAccount = () => {
    let raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if ((!raw || !raw.trim()) && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        if (fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
          raw = fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8");
        }
      } catch {
      }
    }
    if (!raw || !raw.trim()) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.project_id && parsed?.client_email && parsed?.private_key) {
        return {
          project_id: String(parsed.project_id),
          client_email: String(parsed.client_email),
          private_key: String(parsed.private_key).replace(/\\n/g, "\n")
        };
      }
    } catch {
      console.warn("FIREBASE_SERVICE_ACCOUNT_JSON inv\xE1lido no ambiente.");
    }
    return null;
  };
  const getFcmOAuthAccessToken = async () => {
    if (cachedFcmAccessToken && cachedFcmAccessToken.expiresAtMs > Date.now() + 6e4) {
      return {
        accessToken: cachedFcmAccessToken.token,
        projectId: cachedFcmAccessToken.projectId
      };
    }
    const sa = parseFirebaseServiceAccount();
    if (!sa) return null;
    try {
      const nowSec = Math.floor(Date.now() / 1e3);
      const headerB64 = Buffer.from(
        JSON.stringify({ alg: "RS256", typ: "JWT" })
      ).toString("base64url");
      const claimSetB64 = Buffer.from(
        JSON.stringify({
          iss: sa.client_email,
          scope: "https://www.googleapis.com/auth/firebase.messaging",
          aud: "https://oauth2.googleapis.com/token",
          iat: nowSec,
          exp: nowSec + 3600
        })
      ).toString("base64url");
      const signingInput = `${headerB64}.${claimSetB64}`;
      const signer = crypto.createSign("RSA-SHA256");
      signer.update(signingInput);
      const signatureB64 = signer.sign(sa.private_key, "base64url");
      const jwtAssertion = `${signingInput}.${signatureB64}`;
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: jwtAssertion
        })
      });
      if (!tokenRes.ok) {
        console.warn("Falha ao obter token OAuth2 para FCM HTTP v1:", tokenRes.status);
        return null;
      }
      const tokenData = await tokenRes.json();
      if (tokenData?.access_token) {
        cachedFcmAccessToken = {
          token: tokenData.access_token,
          expiresAtMs: Date.now() + Number(tokenData.expires_in || 3500) * 1e3,
          projectId: sa.project_id
        };
        return {
          accessToken: tokenData.access_token,
          projectId: sa.project_id
        };
      }
    } catch (err) {
      console.warn("Erro ao autenticar Service Account FCM:", err);
    }
    return null;
  };
  const dispatchFcmHttpV1ToTargets = async (alert) => {
    const state = readSharedState();
    const allTokens = Array.isArray(state.fcmTokens) ? state.fcmTokens : [];
    const activeEntries = allTokens.filter((t) => t && t.active);
    const targetClassSet = new Set(
      Array.isArray(alert.targetClassIds) ? alert.targetClassIds : []
    );
    const sendToAllClasses = targetClassSet.size === 0 || targetClassSet.has("all");
    const matchingEntries = activeEntries.filter((entry) => {
      if (alert.targetAudience === "peb1" && entry.userRole !== "usuario") {
        return false;
      }
      if (!sendToAllClasses && entry.userRole !== "admin") {
        const userCls = Array.isArray(entry.assignedClassIds) ? entry.assignedClassIds : [];
        return userCls.some((cid) => targetClassSet.has(cid));
      }
      return true;
    });
    if (matchingEntries.length === 0) {
      return {
        deliveredFcmCount: 0,
        fcmHttpV1Count: 0,
        webPushCount: 0,
        failedFcmCount: 0,
        invalidTokenIds: []
      };
    }
    const vapid = ensureAutoWebPushVapidKeys();
    const oauth = await getFcmOAuthAccessToken();
    let deliveredFcmCount = 0;
    let fcmHttpV1Count = 0;
    let webPushCount = 0;
    let failedFcmCount = 0;
    const invalidTokenIds = [];
    const singleClassId = Array.isArray(alert.targetClassIds) && alert.targetClassIds.length === 1 ? String(alert.targetClassIds[0]) : "all";
    const targetScreen = String(alert.targetScreen || "frequencia_mensal");
    const deepLinkUrl = `/?screen=${encodeURIComponent(targetScreen)}${singleClassId !== "all" ? `&classId=${encodeURIComponent(singleClassId)}` : ""}`;
    const webPushPayloadStr = JSON.stringify({
      notification: {
        title: alert.title,
        body: alert.body,
        icon: "/pwa-192x192.png",
        badge: "/favicon-32x32.png"
      },
      data: {
        alertId: String(alert.id || ""),
        category: String(alert.category || "prazo"),
        urgency: String(alert.urgency || "warning"),
        targetScreen,
        targetClassId: singleClassId,
        closingDateFormatted: String(alert.closingDateFormatted || ""),
        authorName: String(alert.createdByName || "EMEB Candel\xE1rio"),
        url: deepLinkUrl
      }
    });
    for (const entry of matchingEntries) {
      let sentForEntry = false;
      if (oauth && typeof entry.fcmToken === "string" && entry.fcmToken.length > 20) {
        try {
          const res = await fetch(
            `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(
              oauth.projectId
            )}/messages:send`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${oauth.accessToken}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                message: {
                  token: entry.fcmToken,
                  notification: {
                    title: alert.title,
                    body: alert.body
                  },
                  data: {
                    alertId: String(alert.id || ""),
                    category: String(alert.category || "prazo"),
                    urgency: String(alert.urgency || "warning"),
                    targetScreen,
                    targetClassId: singleClassId,
                    closingDateFormatted: String(alert.closingDateFormatted || ""),
                    authorName: String(alert.createdByName || "EMEB Candel\xE1rio"),
                    url: deepLinkUrl
                  },
                  webpush: {
                    headers: {
                      Urgency: alert.urgency === "urgent" ? "high" : "normal",
                      TTL: "43200"
                    },
                    notification: {
                      title: alert.title,
                      body: alert.body,
                      icon: "/pwa-192x192.png",
                      badge: "/favicon-32x32.png",
                      tag: String(alert.id || "candelario_fcm_window"),
                      requireInteraction: alert.urgency === "urgent" || alert.category === "prazo"
                    },
                    fcm_options: {
                      link: deepLinkUrl
                    }
                  }
                }
              })
            }
          );
          if (res.ok) {
            deliveredFcmCount++;
            fcmHttpV1Count++;
            sentForEntry = true;
          } else {
            const errBody = await res.json().catch(() => ({}));
            const statusStr = JSON.stringify(errBody);
            if (res.status === 404 || statusStr.includes("UNREGISTERED") || statusStr.includes("registration-token-not-registered")) {
              invalidTokenIds.push(entry.id);
              failedFcmCount++;
            } else {
              console.warn("FCM HTTP v1 send error:", res.status, statusStr);
              failedFcmCount++;
            }
          }
        } catch (err) {
          console.warn("FCM HTTP v1 request error:", err);
          failedFcmCount++;
        }
      }
      if (!sentForEntry && entry.vapidSource !== "firebase_fcm" && entry.pushSubscription && typeof entry.pushSubscription.endpoint === "string" && entry.pushSubscription.keys?.p256dh && entry.pushSubscription.keys?.auth) {
        try {
          await webpush.sendNotification(
            entry.pushSubscription,
            webPushPayloadStr,
            {
              vapidDetails: {
                subject: vapid.subject,
                publicKey: vapid.publicKey,
                privateKey: vapid.privateKey
              },
              TTL: 60 * 60 * 12,
              urgency: alert.urgency === "urgent" ? "high" : "normal"
            }
          );
          deliveredFcmCount++;
          webPushCount++;
          sentForEntry = true;
        } catch (err) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            invalidTokenIds.push(entry.id);
          } else {
            failedFcmCount++;
          }
        }
      }
    }
    if (invalidTokenIds.length > 0) {
      const cleaned = allTokens.map(
        (t) => invalidTokenIds.includes(t.id) ? { ...t, active: false, fcmToken: void 0, pushSubscription: void 0 } : t
      );
      writeSharedState({ fcmTokens: cleaned });
    }
    return {
      deliveredFcmCount,
      fcmHttpV1Count,
      webPushCount,
      failedFcmCount,
      invalidTokenIds
    };
  };
  app.get("/api/fcm/vapid-public-key", requireInstitutionalAuth, (_req, res) => {
    const state = readSharedState();
    const autoKeys = ensureAutoWebPushVapidKeys();
    const envVapid = (process.env.VITE_FIREBASE_VAPID_KEY || "").trim();
    const customVapid = state.fcmConfig?.vapidPublicKey?.trim();
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({
      publicKey: autoKeys.publicKey,
      firebaseVapidKey: envVapid || customVapid || "",
      autoConfigured: true
    });
  });
  app.post("/api/fcm/register-token", requireInstitutionalAuth, (req, res) => {
    const validation = validateFcmRegisterTokenPayload(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const sub = validation.data;
    const reqUser = extractRequestUser(req);
    const incomingEmail = String(sub.userEmail).trim().toLowerCase();
    if (!reqUser.isAdmin && incomingEmail !== reqUser.email) {
      res.status(403).json({ error: "Voc\xEA s\xF3 pode registrar o dispositivo da sua pr\xF3pria conta." });
      return;
    }
    const cleanPushSub = sub.pushSubscription && typeof sub.pushSubscription.endpoint === "string" && sub.pushSubscription.keys?.p256dh && sub.pushSubscription.keys?.auth ? {
      endpoint: String(sub.pushSubscription.endpoint).slice(0, 1024),
      expirationTime: sub.pushSubscription.expirationTime ?? null,
      keys: {
        p256dh: String(sub.pushSubscription.keys.p256dh).slice(0, 256),
        auth: String(sub.pushSubscription.keys.auth).slice(0, 128)
      }
    } : void 0;
    const state = readSharedState();
    const existing = Array.isArray(state.fcmTokens) ? state.fcmTokens : [];
    const hasPushChannel = Boolean(sub.fcmToken || cleanPushSub);
    const cleanSub = {
      id: String(sub.id).slice(0, 128),
      userEmail: incomingEmail,
      userName: String(sub.userName || incomingEmail.split("@")[0]).slice(0, 160),
      userRole: String(sub.userRole || reqUser.role || "usuario").slice(0, 30),
      teacherRoleType: sub.teacherRoleType || void 0,
      assignedClassIds: Array.isArray(sub.assignedClassIds) ? sub.assignedClassIds.slice(0, 50) : [],
      fcmToken: typeof sub.fcmToken === "string" ? sub.fcmToken.slice(0, 512) : void 0,
      vapidSource: sub.vapidSource === "firebase_fcm" ? "firebase_fcm" : "auto_webpush",
      ...cleanPushSub ? { pushSubscription: cleanPushSub } : {},
      channel: hasPushChannel ? "fcm_push" : "sw_realtime",
      permission: sub.permission || "granted",
      deviceLabel: String(sub.deviceLabel || "Navegador Web").slice(0, 80),
      active: sub.active !== false,
      createdAtISO: sub.createdAtISO || (/* @__PURE__ */ new Date()).toISOString(),
      updatedAtMs: Date.now()
    };
    const nextTokens = [
      cleanSub,
      ...existing.filter((t) => t && t.id !== cleanSub.id)
    ].slice(0, 200);
    writeSharedState({ fcmTokens: nextTokens });
    res.json({
      ok: true,
      id: cleanSub.id,
      channel: cleanSub.channel,
      hasNativeFcmToken: Boolean(cleanSub.fcmToken)
    });
  });
  app.post("/api/fcm/unregister-token", requireInstitutionalAuth, (req, res) => {
    const validation = validateFcmUnregisterTokenPayload(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { id, userEmail } = validation.data;
    const reqUser = extractRequestUser(req);
    const targetEmail = String(userEmail || reqUser.email).trim().toLowerCase();
    if (!reqUser.isAdmin && targetEmail !== reqUser.email) {
      res.status(403).json({ error: "Opera\xE7\xE3o n\xE3o autorizada para outro usu\xE1rio." });
      return;
    }
    const state = readSharedState();
    const existing = Array.isArray(state.fcmTokens) ? state.fcmTokens : [];
    const nextTokens = existing.map(
      (t) => t && (t.id === id || t.userEmail === targetEmail) ? {
        ...t,
        active: false,
        fcmToken: void 0,
        pushSubscription: void 0,
        updatedAtMs: Date.now()
      } : t
    );
    writeSharedState({ fcmTokens: nextTokens });
    res.json({ ok: true });
  });
  app.get("/api/fcm/status", requireInstitutionalAuth, (req, res) => {
    const reqUser = extractRequestUser(req);
    const autoKeys = ensureAutoWebPushVapidKeys();
    const state = readSharedState();
    const tokens = Array.isArray(state.fcmTokens) ? state.fcmTokens : [];
    const activeTokens = tokens.filter((t) => t && t.active);
    const sa = parseFirebaseServiceAccount();
    const envVapid = (process.env.VITE_FIREBASE_VAPID_KEY || "").trim();
    const configuredVapid = (state.fcmConfig?.vapidPublicKey || "").trim();
    const effectiveVapid = envVapid || configuredVapid;
    const fcmConfig = {
      vapidPublicKey: effectiveVapid,
      autoWindowAlertsEnabled: state.fcmConfig?.autoWindowAlertsEnabled ?? true,
      notifyDaysBeforeClose: state.fcmConfig?.notifyDaysBeforeClose ?? 2,
      remindPendingTeachersOnly: state.fcmConfig?.remindPendingTeachersOnly ?? true,
      updatedAtMs: state.fcmConfig?.updatedAtMs
    };
    const visibleSummaries = (reqUser.isAdmin ? activeTokens : activeTokens.filter((t) => t.userEmail === reqUser.email)).map((t) => ({
      id: t.id,
      userEmail: t.userEmail,
      userName: t.userName,
      userRole: t.userRole,
      assignedClassIds: Array.isArray(t.assignedClassIds) ? t.assignedClassIds : [],
      channel: t.channel,
      deviceLabel: t.deviceLabel,
      active: Boolean(t.active),
      updatedAtMs: t.updatedAtMs,
      hasFcmToken: Boolean(t.fcmToken || t.pushSubscription?.endpoint),
      hasNativeFcmToken: Boolean(t.fcmToken)
    }));
    const pushCapableCount = activeTokens.filter(
      (t) => Boolean(t.fcmToken || t.pushSubscription?.endpoint)
    ).length;
    const realFcmTokensCount = activeTokens.filter((t) => Boolean(t.fcmToken)).length;
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({
      autoConfigured: true,
      hasServiceAccountConfigured: Boolean(sa) || Boolean(autoKeys.publicKey),
      hasFirebaseAdminAccount: Boolean(sa),
      hasViteVapidKey: Boolean(envVapid),
      fcmHttpV1Ready: Boolean(sa && effectiveVapid),
      firebaseProjectId: "ListaPilotoCandelario2027",
      gcpProjectId: sa?.project_id || null,
      hasVapidKey: Boolean(effectiveVapid || autoKeys.publicKey),
      autoVapidPublicKey: autoKeys.publicKey,
      totalRegisteredDevices: activeTokens.length,
      activeFcmTokensCount: pushCapableCount,
      realFcmTokensCount,
      teachersCoveredEmails: reqUser.isAdmin ? Array.from(new Set(activeTokens.map((t) => t.userEmail))) : [reqUser.email],
      recentDispatches: (state.fcmAlerts || []).slice(0, 20),
      fcmConfig,
      tokensSummary: visibleSummaries
    });
  });
  app.post("/api/fcm/config", requireAdminAuth, (req, res) => {
    const validation = validateFcmConfigPayload(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { fcmConfig } = validation.data;
    const reqUser = extractRequestUser(req);
    const cleanConfig = {
      vapidPublicKey: String(fcmConfig.vapidPublicKey || "").trim().slice(0, 256),
      autoWindowAlertsEnabled: Boolean(fcmConfig.autoWindowAlertsEnabled),
      notifyDaysBeforeClose: Math.max(1, Math.min(5, Number(fcmConfig.notifyDaysBeforeClose || 2))),
      remindPendingTeachersOnly: fcmConfig.remindPendingTeachersOnly !== false,
      updatedAtMs: Date.now(),
      updatedByEmail: reqUser.email
    };
    writeSharedState({ fcmConfig: cleanConfig });
    recordSecurityAuditLog(
      "FCM_CONFIG_UPDATED",
      `Configura\xE7\xE3o FCM atualizada: alertas autom\xE1ticos=${cleanConfig.autoWindowAlertsEnabled ? "ATIVOS" : "INATIVOS"}, anteced\xEAncia=${cleanConfig.notifyDaysBeforeClose}d.`,
      req
    );
    void checkServerSideWindowClosingAlert();
    res.json({ ok: true, fcmConfig: cleanConfig });
  });
  app.post("/api/fcm/send-window-alert", requireAdminAuth, async (req, res) => {
    const validation = validateFcmSendWindowAlertPayload(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }
    const { alert } = validation.data;
    const reqUser = extractRequestUser(req);
    const nowMs = Date.now();
    const enrichedAlert = {
      id: String(alert.id || `fcm_win_${nowMs}`).slice(0, 128),
      title: String(alert.title).slice(0, 180),
      body: String(alert.body).slice(0, 600),
      category: alert.category || "prazo",
      urgency: alert.urgency || "warning",
      targetScreen: alert.targetScreen || "frequencia_mensal",
      targetClassIds: Array.isArray(alert.targetClassIds) ? alert.targetClassIds : ["all"],
      targetAudience: alert.targetAudience || "pending_only",
      closingDateFormatted: String(alert.closingDateFormatted || ""),
      windowPhase: String(alert.windowPhase || "closing_soon"),
      createdAtMs: alert.createdAtMs || nowMs,
      createdAtISO: alert.createdAtISO || new Date(nowMs).toISOString(),
      createdByEmail: reqUser.email || alert.createdByEmail || "emebjfreitas@jundiai.sp.gov.br",
      createdByName: reqUser.name || alert.createdByName || "Gest\xE3o Escolar",
      pendingClassesCount: Number(alert.pendingClassesCount || 0)
    };
    const dispatchResult = await dispatchFcmHttpV1ToTargets(enrichedAlert);
    const savedAlert = {
      ...enrichedAlert,
      deliveredFcmCount: dispatchResult.deliveredFcmCount
    };
    const state = readSharedState();
    const nextAlerts = [savedAlert, ...state.fcmAlerts || []].slice(0, 40);
    writeSharedState({ fcmAlerts: nextAlerts });
    broadcastRealtimeEvent("fcm:alert", { alert: savedAlert }, getRequestClientId(req));
    recordSecurityAuditLog(
      "FCM_WINDOW_ALERT_DISPATCHED",
      `Alerta FCM disparado: "${savedAlert.title}" (${dispatchResult.fcmHttpV1Count} FCM HTTP v1 + ${dispatchResult.webPushCount} Web Push).`,
      req
    );
    const message = dispatchResult.deliveredFcmCount > 0 ? `Alerta entregue via FCM Push (${dispatchResult.fcmHttpV1Count} HTTP v1${dispatchResult.webPushCount > 0 ? ` + ${dispatchResult.webPushCount} Web Push` : ""}) e publicado em tempo real.` : "Alerta publicado em tempo real para todos os professores conectados. Novos dispositivos receber\xE3o em segundo plano ao ativar as notifica\xE7\xF5es.";
    res.json({
      ok: true,
      alert: savedAlert,
      deliveredFcmCount: dispatchResult.deliveredFcmCount,
      fcmHttpV1Count: dispatchResult.fcmHttpV1Count,
      webPushCount: dispatchResult.webPushCount,
      failedFcmCount: dispatchResult.failedFcmCount,
      message
    });
  });
  app.get("/api/fcm/alerts", requireInstitutionalAuth, (req, res) => {
    const state = readSharedState();
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({
      alerts: (state.fcmAlerts || []).slice(0, 20)
    });
  });
  const checkServerSideWindowClosingAlert = async () => {
    try {
      const state = readSharedState();
      const autoEnabled = state.fcmConfig?.autoWindowAlertsEnabled ?? true;
      if (!autoEnabled) return;
      const notifyDays = Math.max(
        1,
        Math.min(5, Number(state.fcmConfig?.notifyDaysBeforeClose ?? 2))
      );
      const remindPendingOnly = state.fcmConfig?.remindPendingTeachersOnly !== false;
      const winCfg = state.attendanceWindowConfig || { exceptionalOverrideOpen: false };
      const refDate = winCfg.simulatedDateISO ? /* @__PURE__ */ new Date(`${winCfg.simulatedDateISO}T12:00:00`) : /* @__PURE__ */ new Date();
      const y = refDate.getFullYear();
      const m = refDate.getMonth();
      const d = refDate.getDate();
      const daysInM = new Date(y, m + 1, 0).getDate();
      const weekdays = [];
      for (let i = 1; i <= daysInM; i++) {
        const dow = new Date(y, m, i).getDay();
        if (dow >= 1 && dow <= 5) weekdays.push(i);
      }
      const firstTwo = weekdays.slice(0, 2);
      const lastDay = weekdays[weekdays.length - 1] || daysInM;
      const isSecondClosingDay = d === firstTwo[1];
      const isFirstClosingDay = d === firstTwo[0];
      const isLastMonthSchoolDay = d === lastDay;
      const isClosingSoon = d >= lastDay - notifyDays && d < lastDay;
      const isOverrideOpen = Boolean(winCfg.exceptionalOverrideOpen);
      if (!isSecondClosingDay && !isFirstClosingDay && !isLastMonthSchoolDay && !isClosingSoon && !isOverrideOpen) {
        return;
      }
      const allClasses = Array.isArray(state.classes) ? state.classes : [];
      const pendingClasses = allClasses.filter((c) => c && c.isPending);
      if (remindPendingOnly && allClasses.length > 0 && pendingClasses.length === 0) {
        return;
      }
      const todayISO = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const phaseTag = isOverrideOpen ? "override_open" : isSecondClosingDay ? "final_day" : isFirstClosingDay ? "first_closing_day" : isLastMonthSchoolDay ? "last_month_day" : "closing_soon";
      const windowKey = `${todayISO}|${phaseTag}`;
      if (state.lastAutoFcmWindowKey === windowKey) return;
      const nextMonthIdx = (m + 1) % 12;
      const nextMonthYear = m === 11 ? y + 1 : y;
      const nextWeekdays = [];
      const daysInNext = new Date(nextMonthYear, nextMonthIdx + 1, 0).getDate();
      for (let i = 1; i <= daysInNext; i++) {
        const dow = new Date(nextMonthYear, nextMonthIdx, i).getDay();
        if (dow >= 1 && dow <= 5) nextWeekdays.push(i);
      }
      const deadlineDate = isFirstClosingDay || isSecondClosingDay ? new Date(y, m, firstTwo[1] || 2) : new Date(nextMonthYear, nextMonthIdx, nextWeekdays[1] || 2);
      const deadlineStr = deadlineDate.toLocaleDateString("pt-BR");
      const openStr = new Date(y, m, lastDay).toLocaleDateString("pt-BR");
      const daysToOpen = Math.max(1, lastDay - d);
      const title = isOverrideOpen ? `Libera\xE7\xE3o Excepcional Ativa \u2022 ${MONTH_NAMES_PT[m]}` : isSecondClosingDay ? `\xDALTIMO DIA: Fechamento de Frequ\xEAncia Hoje (${deadlineStr})` : isFirstClosingDay ? `Janela de Frequ\xEAncia Fecha Amanh\xE3 (${deadlineStr})` : isLastMonthSchoolDay ? `Janela de Lan\xE7amento Aberta Hoje (${MONTH_NAMES_PT[m]})` : `Fechamento de Frequ\xEAncia em ${daysToOpen} dia(s) (${MONTH_NAMES_PT[m]})`;
      const pendingSummaryText = pendingClasses.length > 0 ? `${pendingClasses.length} turma(s) com lan\xE7amento pendente.` : "Confira os lan\xE7amentos de sua turma.";
      const body = isOverrideOpen ? `A gest\xE3o liberou o lan\xE7amento de presen\xE7a em car\xE1ter excepcional. ${pendingSummaryText} Toque para acessar a Frequ\xEAncia Mensal.` : isClosingSoon ? `A janela oficial abre em ${openStr} e encerra em ${deadlineStr}. ${pendingSummaryText} Prepare faltas e atestados.` : `${pendingSummaryText} Conclua a confer\xEAncia de faltas e atestados at\xE9 ${deadlineStr} para evitar pend\xEAncias no fechamento mensal.`;
      const targetIds = remindPendingOnly && pendingClasses.length > 0 ? pendingClasses.map((c) => c.id) : ["all"];
      const autoAlert = {
        id: `fcm_auto_${todayISO.replace(/-/g, "")}_${phaseTag}`,
        title,
        body,
        category: "prazo",
        urgency: isSecondClosingDay ? "urgent" : "warning",
        targetScreen: "frequencia_mensal",
        targetClassIds: targetIds,
        targetAudience: remindPendingOnly ? "pending_only" : "all",
        closingDateFormatted: deadlineStr,
        windowPhase: phaseTag,
        createdAtMs: Date.now(),
        createdAtISO: (/* @__PURE__ */ new Date()).toISOString(),
        createdByEmail: "emebjfreitas@jundiai.sp.gov.br",
        createdByName: "Monitor Autom\xE1tico FCM",
        pendingClassesCount: pendingClasses.length
      };
      const dispatchRes = await dispatchFcmHttpV1ToTargets(autoAlert);
      const savedAlert = { ...autoAlert, deliveredFcmCount: dispatchRes.deliveredFcmCount };
      writeSharedState({
        lastAutoFcmWindowKey: windowKey,
        fcmAlerts: [savedAlert, ...state.fcmAlerts || []].slice(0, 40)
      });
    } catch {
    }
  };
  setTimeout(() => {
    void checkServerSideWindowClosingAlert();
  }, 8e3);
  setInterval(() => {
    void checkServerSideWindowClosingAlert();
  }, 15 * 60 * 1e3);
  app.get("/health", (_req, res) => {
    res.status(200).send("OK");
  });
  app.use((req, res, next) => {
    if (/^\/(\.env|service-account|firebase-adminsdk|credentials)/i.test(req.path)) {
      res.status(403).end();
      return;
    }
    next();
  });
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      appType: "spa"
    });
    app.use(async (req, res, next) => {
      if (req.path.endsWith("/@vite/client")) {
        try {
          const transformed = await vite.transformRequest("/@vite/client");
          if (transformed?.code) {
            const safeCode = transformed.code.replace(
              "transport.connect(createHMRHandler(handleMessage));",
              "// HMR WebSocket disabled"
            ).replace(
              /new WebSocket\([^)]*\)/g,
              "({ addEventListener(){}, removeEventListener(){}, close(){}, send(){}, readyState: 3, OPEN: 1, CLOSED: 3 })"
            );
            res.setHeader("Content-Type", "application/javascript");
            res.setHeader("Cache-Control", "no-store");
            res.send(safeCode);
            return;
          }
        } catch {
        }
      }
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 2 * 1024 * 1024
  });
  wss.on("connection", async (ws, request) => {
    const clientEntry = {
      ws,
      user: null,
      isAlive: true,
      readySent: false
    };
    wsClients.add(clientEntry);
    const sendReadyOnce = () => {
      if (clientEntry.readySent || ws.readyState !== WebSocket.OPEN) return;
      clientEntry.readySent = true;
      try {
        ws.send(JSON.stringify({ type: "ready", ts: Date.now() }));
      } catch {
      }
    };
    try {
      const cookies = parseCookiesFromRequest(request);
      const sessionCookie = cookies[SESSION_COOKIE_NAME];
      if (sessionCookie) {
        const parsedCookie = verifySessionCookieValue(sessionCookie);
        if (parsedCookie) {
          const built = buildAuthorizedRequestUser(
            parsedCookie.email,
            parsedCookie.name,
            parsedCookie.uid,
            "signed_cookie"
          );
          if (built.user) {
            clientEntry.user = built.user;
          }
        }
      }
    } catch {
    }
    const authTimeout = setTimeout(() => {
      if (!clientEntry.user) {
        try {
          ws.close(4401, "Sess\xE3o WebSocket n\xE3o autenticada");
        } catch {
        }
        wsClients.delete(clientEntry);
      } else {
        sendReadyOnce();
      }
    }, 6e3);
    ws.on("pong", () => {
      clientEntry.isAlive = true;
    });
    ws.on("message", async (rawData) => {
      let msg = null;
      try {
        msg = JSON.parse(String(rawData));
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== "string") return;
      if (msg.type === "ping") {
        clientEntry.isAlive = true;
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
          } catch {
          }
        }
        return;
      }
      if (msg.type === "auth") {
        if (typeof msg.clientId === "string" && msg.clientId.trim()) {
          clientEntry.clientId = msg.clientId.trim().slice(0, 128);
        }
        if (typeof msg.token === "string" && msg.token.trim()) {
          const verified = await verifyFirebaseIdToken(msg.token.trim());
          if (verified) {
            const built = buildAuthorizedRequestUser(
              verified.email,
              verified.name,
              verified.uid,
              "firebase_jwt"
            );
            if (built.user) {
              clientEntry.user = built.user;
            }
          }
        }
        if (clientEntry.user && clientEntry.user.isInstitutional) {
          clearTimeout(authTimeout);
          sendReadyOnce();
        } else {
          clearTimeout(authTimeout);
          try {
            ws.close(4401, "Credenciais inv\xE1lidas para WebSocket");
          } catch {
          }
          wsClients.delete(clientEntry);
        }
      }
    });
    ws.on("close", () => {
      clearTimeout(authTimeout);
      wsClients.delete(clientEntry);
    });
    ws.on("error", () => {
      clearTimeout(authTimeout);
      wsClients.delete(clientEntry);
    });
  });
  const wsHeartbeatInterval = setInterval(() => {
    wsClients.forEach((client) => {
      if (!client.isAlive) {
        try {
          client.ws.terminate();
        } catch {
        }
        wsClients.delete(client);
        return;
      }
      client.isAlive = false;
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.ping();
        } catch {
        }
      }
    });
  }, 3e4);
  httpServer.on("close", () => {
    clearInterval(wsHeartbeatInterval);
  });
  httpServer.on("upgrade", (request, socket, head) => {
    let pathname = "";
    try {
      pathname = new URL(request.url || "/", "http://localhost").pathname;
    } catch {
      pathname = "";
    }
    if (pathname !== "/ws/realtime") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor EMEB Candel\xE1rio de Freitas rodando em http://localhost:${PORT}`);
  });
}
startServer();
