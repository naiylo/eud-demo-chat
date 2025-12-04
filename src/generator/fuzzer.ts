import type { Message } from "../db/sqlite";

export interface FuzzOptions {
    population?: number;
    generations?: number;
    maxLength?: number;
}

export interface Constraint {
    name: string;
    description: string;
    validation: (stream: Message[]) => boolean;
}

export interface Action {
    name: string;
    description: string;
    preconditions: Constraint[];
}

const DEFAULT_OPTIONS: Required<FuzzOptions> = {
    population: 30,
    generations: 30,
    maxLength: 40,
};

const PERSONAS = ["designer", "engineer", "pm"];

function nowIso(offsetMs = 0) {
    return new Date(Date.now() + offsetMs).toISOString();
}

const polls: string[] = [];

// reference: use an id referring to a poll
function makeId(prefix: string, reference = false): string {
    if (reference) {
        return polls[Math.floor(Math.random() * polls.length)];
    }
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function createText(authorId: string, rng: () => number): Message {
    const texts = [
        "hi",
        "hans",
        "status update",
        "look at this",
        "I see",
        "please fix",
    ];
    const t = texts[Math.floor(rng() * texts.length)];
    return {
        id: makeId("msg"),
        authorId,
        text: t,
        timestamp: nowIso(Math.floor(rng() * 1000)),
        type: "message",
        custom: [],
    };
}

function createPoll(authorId: string): Message {
    const promptPool = ["Favorite color?", "Lunch plans?", "Which feature?"];
    const optionsPool = [
        ["Red", "Blue", "Green"],
        ["Pizza", "Salad", "Kebab", "Whatever mensa offers", "Beer"],
        ["A", "B", "C", "D"],
    ];

    const idx = Math.floor(Math.random() * promptPool.length);

    const pollId = makeId("poll");
    polls.push(pollId);

    return {
        id: pollId,
        authorId,
        text: promptPool[idx],
        timestamp: nowIso(Math.floor(Math.random() * 1000)),
        type: "createPoll",
        custom: { prompt: promptPool[idx], options: optionsPool[idx] },
    };
}

function createVote(authorId: string, pollId?: string, optionIndex?: number): Message {
    return {
        id: makeId("vote"),
        authorId,
        text: "",
        timestamp: nowIso(Math.floor(Math.random() * 1000)),
        type: "vote",
        custom: {
            pollId: pollId ?? makeId("poll", true),
            optionIndex: optionIndex ?? Math.floor(Math.random() * 4),
        },
    };
}

function cloneMessageStream(stream: Message[]): Message[] {
    return stream.map((m) => ({ ...m, custom: JSON.parse(JSON.stringify(m.custom)) }));
}

// Heuristic scoring: reward "interesting" or "dangerous" patterns
function fitness(stream: Message[], actions: Action[]): number {
    let score = 0;

    for (const action of actions) {
        action.preconditions.forEach((constraint) => {
            if (!constraint.validation(stream)) {
                score -= 10;
            } else {
                score += 5;
            }
        });
    }

    return score;
}

function randomInitial(maxLen: number): Message[] {
    const len = 3 + Math.floor(Math.random() * Math.min(12, maxLen));
    const stream: Message[] = [];
    for (let i = 0; i < len; i++) {
        const a = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
        const pick = Math.random();

        if (pick < 0.35) 
            stream.push(createText(a, Math.random));
        else if (pick < 0.55) 
            stream.push(createPoll(a));
        else 
            stream.push(createVote(a));
    }
    return stream;
}

function mutate(stream: Message[], maxLen: number): Message[] {
    const streamClone = cloneMessageStream(stream);
    const operation = Math.random();
    if (operation < 0.2 && streamClone.length < maxLen) {
        // insert random
        const who = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
        const choice = Math.random();
        let m: Message;

        if (choice < 0.3) 
            m = createText(who, Math.random);
        else if (choice < 0.5) 
            m = createPoll(who);
        else 
            m = createVote(who);

        const pos = Math.floor(Math.random() * (streamClone.length + 1));
        streamClone.splice(pos, 0, m);
    } else if (operation < 0.4 && streamClone.length > 0) {
        // delete random
        streamClone.splice(Math.floor(Math.random() * streamClone.length), 1);
    } else if (operation < 0.6 && streamClone.length > 0) {
        // mutate a random message
        const msgId = Math.floor(Math.random() * streamClone.length);
        const m = streamClone[msgId];
        mutateMessage(m);
        streamClone[msgId] = m;
    } else if (operation < 0.8 && streamClone.length > 1) {
        // swap two
        const i = Math.floor(Math.random() * streamClone.length);
        const j = Math.floor(Math.random() * streamClone.length);
        const tmp = streamClone[i];
        streamClone[i] = streamClone[j];
        streamClone[j] = tmp;
    } else if (streamClone.length > 0) {
        // duplicate
        const msgId = Math.floor(Math.random() * streamClone.length);
        streamClone.splice(msgId, 0, { ...cloneMessageStream([streamClone[msgId]])[0], id: makeId("msg") });
    }
    return streamClone;
}

function mutateMessage(msg: Message) {
    const operation = Math.random();
    if (msg.type === "vote") {
        // change poll reference or option index
        const customOrig = msg.custom as unknown;
        const customRec: Record<string, unknown> = customOrig && typeof customOrig === "object" && !Array.isArray(customOrig) ? { ...(customOrig as Record<string, unknown>) } : {};
        if (operation > 0.5) 
            customRec.pollId = makeId("poll", true);
        else 
            customRec.optionIndex = Math.max(0, (typeof customRec.optionIndex === "number" ? (customRec.optionIndex as number) : 0) + (Math.random() > 0.5 ? 1 : -1));
        
        msg.custom = customRec as unknown;
    } else if (msg.type === "createPoll") {
        const customOrig = msg.custom as unknown;
        const customRec: Record<string, unknown> = customOrig && typeof customOrig === "object" && !Array.isArray(customOrig) ? { ...(customOrig as Record<string, unknown>) } : {};
        if (operation > 0.5) 
            customRec.options = [...((customRec.options as unknown[]) ?? []), "extra"];
        msg.custom = customRec as unknown;
    } else {
        // tweak text
        msg.text = (msg.text ?? "") + (operation > 0.6 ? "!" : "");
    }
}

function crossover(a: Message[], b: Message[]): Message[] {
    if (a.length === 0 || b.length === 0) 
        return cloneMessageStream(Math.random() > 0.5 ? a : b);

    const cutA = Math.floor(Math.random() * a.length);
    const cutB = Math.floor(Math.random() * b.length);
    const child = cloneMessageStream(a.slice(0, cutA).concat(b.slice(cutB)));
    
    return child;
}

export function generatePollMessageStream(actions: Action[], options?: FuzzOptions): Message[] {
    const opts = { ...DEFAULT_OPTIONS, ...(options ?? {}) } as Required<FuzzOptions>;

    // initialize population
    const population: Message[][] = [];
    for (let i = 0; i < opts.population; i++) 
        population.push(randomInitial(opts.maxLength));

    let best: Message[] = population[0];
    let bestScore = fitness(best, actions);

    for (let gen = 0; gen < opts.generations; gen++) {
        // score all
        const scored = population.map((individual) => ({ individual: individual, score: fitness(individual, actions) }));
        scored.sort((a, b) => b.score - a.score);
        
        if (scored[0].score > bestScore) {
            best = cloneMessageStream(scored[0].individual);
            bestScore = scored[0].score;
        }

        // produce next generation
        const nextGen: Message[][] = [];
        // keep top 2
        nextGen.push(cloneMessageStream(scored[0].individual));
        if (scored[1])
            nextGen.push(cloneMessageStream(scored[1].individual));

        while (nextGen.length < opts.population) {
            const pA = scored[Math.floor(Math.random() * Math.min(scored.length, 10))].individual;
            const pB = scored[Math.floor(Math.random() * Math.min(scored.length, 10))].individual;

            let child = crossover(pA, pB);
            if (Math.random() < 0.7) 
                child = mutate(child, opts.maxLength);

            nextGen.push(child);
        }

        for (let i = 0; i < population.length; i++) 
            population[i] = nextGen[i];
    }

    // make timestamps monotonic
    const out = cloneMessageStream(best);
    const base = Date.now() - out.length * 1000;
    for (let i = 0; i < out.length; i++) {
        out[i].timestamp = new Date(base + i * 1000).toISOString();
    }

    return out;
}

console.log(generatePollMessageStream([], { population: 10, generations: 15, maxLength: 30 }));
