### Code → Python Model → Logical Rules → CrossHair Verification → Actionable Feedback

# STEP 1: User Provides Widget Code + Behavior Description

The user begins with two inputs:

- **Widget Code:** The complete code of the widget (frontend and backend).
- **Behavior Description:** How the widget is intended to behave.

### Prompt Template

```
Input:
<RAW WIDGET CODE>
<BEHAVIOR DESCRIPTION>

Task:
Extract all explicit and implicit logical rules from the widget and description.
Do not generate Python yet.
Do not generate tests.
Produce a single JSON object as the output, following this schema:

{
  "widget_metadata": {
    "name": string|null,
    "description": string
  },
  "actions": [
    {
      "id": string,
      "name": string,
      "origin": "frontend" | "backend" | "shared" | "unknown",
      "parameters": [ string ],
      "description": string
    }
  ],
  "invariants": [
    {
      "id": string,
      "title": string,
      "category": "data" | "ui" | "behavior" | "security" | "other",
      "expression": string,
      "informal": string
    }
  ],
  "preconditions": [
    {
      "id": string,
      "action": string,
      "expression": string,
      "informal": string
    }
  ],
  "postconditions": [
    {
      "id": string,
      "action": string,
      "expression": string,
      "informal": string
    }
  ],
  "safety_constraints": [
    {
      "id": string,
      "expression": string,
      "informal": string
    }
  ],
  "forbidden_states": [
    {
      "id": string,
      "expression": string,
      "informal": string
    }
  ]
}

Rules:
- Use generic, machine-friendly IDs: e.g. "INV_DATA_RELATION_X", "PRE_SAVE_FORM_VALID", etc.
- Put any formal/math-like constraints into `expression`.
- Output MUST be valid JSON only (no extra text).

```

---

# STEP 2: System Generates Python Logic + CrossHair Rules

The system converts the extracted logic into:

1. **Python Model Code**

   - Pure business logic
   - Dataclasses + pure functions

2. **Logical Rules**

   - Invariants, constraints, behavior rules

3. **CrossHair Verification Functions**
   - `check_*` functions with `pre:` / `post:` contracts

### Prompt Template

```
Input:
<FORMAL SPECIFICATION FROM STEP 1 AS JSON>

Task:
Generate:
1. A clean Python model implementing the behavior (dataclasses + pure functions).
2. A list of logical rules, referencing the IDs in the JSON spec when possible.
3. CrossHair-compatible check_* functions that:
   - Check each operation (action) preserves the invariants and respects constraints.
   - Check that no forbidden state holds.

Output:
Return a single JSON object with this shape:

{
  "files": [
    {
      "path": "widget_model.py",
      "language": "python",
      "lines": [ "line1", "line2", "..." ]
    }
  ],
  "logical_rules": {
    "invariants": [ "<id from spec>", ... ],
    "preconditions": [ "<id from spec>", ... ],
    "postconditions": [ "<id from spec>", ... ],
    "safety_constraints": [ "<id from spec>", ... ],
    "forbidden_states": [ "<id from spec>", ... ]
  },
  "crosshair_entrypoints": [
    {
      "name": "check_<action_name>_preserves_invariants",
      "kind": "operation",
      "operation": "<python_function_name_for_action>",
      "description": "Checks that <python_function_name_for_action> preserves invariants and postconditions when preconditions hold.",
      "related_rule_ids": [
        "INV_... (for all invariants touched by this action)",
        "PRE_... (for this action)",
        "POST_... (for this action)"
      ]
    },
    {
      "name": "check_<action_name>_respects_safety",
      "kind": "operation",
      "operation": "<python_function_name_for_action>",
      "description": "Checks that <python_function_name_for_action> maintains safety constraints and does not produce forbidden states.",
      "related_rule_ids": [
        "SAFE_...",
        "FORBID_..."
      ]
    },
    {
      "name": "check_state_forbidden_states",
      "kind": "state",
      "operation": null,
      "description": "Checks the given state against all forbidden-state predicates.",
      "related_rule_ids": [
        "FORBID_...",
        "SAFE_..."
      ]
    }
  ]
}

Rules:
- Derive `<action_name>` from spec.actions[i].name.
- Map each action to one or more Python functions (e.g. `apply_<action_id>`).
- The output MUST be valid JSON and MUST NOT contain extra commentary.

```

---

# STEP 3: CrossHair Verification

Executed locally:

```
crosshair check widget_model.py
```

CrossHair returns:

- `"No counterexamples found."`
- or detailed counterexamples describing logical failures.

---

# STEP 4: System Interprets CrossHair Output

The system transforms formal output into meaningful developer guidance:

- Which rule failed
- Why the failure happened
- What input triggered it
- Which part of the code is responsible
- How to fix it

### Prompt Template

```
Input:
<CROSSHAIR_OUTPUT_AS_TEXT>
<PYTHON_MODEL_JSON_FROM_STEP_2>
<LOGICAL_RULESET_JSON_FROM_STEP_1>

Task:
Interpret the verification results and produce a structured diagnostic report.

Output:
Return a single JSON object:

{
  "status": "ok" | "failed",
  "summary": string,
  "issues": [
    {
      "id": string,
      "kind": "invariant" | "precondition" | "postcondition" | "safety" | "forbidden_state" | "other",
      "rule_id": string | null,
      "rule_expression": string | null,
      "crosshair_function": string,
      "failing_inputs": {
        "raw": string,
        "parsed": object|null
      },
      "explanation": string,
      "suggested_fix_model": {
        "description": string,
        "patch_hint": string
      },
      "suggested_fix_widget": {
        "description": string,
        "patch_hint": string
      }
    }
  ]
}

Rules:
- If CrossHair reports “No counterexamples found.” then:
  - status = "ok"
  - issues = []
  - summary explains that no logical problems were detected.
- For each counterexample CrossHair reports:
  - Create one entry in `issues`.
  - Populate `rule_id` by matching against the logical rule IDs when possible; otherwise null.
  - Put the raw counterexample text into `failing_inputs.raw`.
- The output MUST be valid JSON and MUST NOT contain extra commentary.

```

### Example (Positive no logical problems in code)

## Pre-Conditions

# Code

```
Msg
	type=poll
	prompt=""
	options=[a, b, c]
	multiple=false
	anonmyous=false
	canRetract=true
	author=user

Msg
	type=vote
	option=i
	author=user
	poll=<>

View for type=poll
	votes := type=vote AND poll=<>
	Text(prompt)
	foreach option, index in options:
		checked := votes AND option=i AND user=self
		Checkbox(Submit(index), checked=checked, readonly=checked)
		Text(option)
		ProgressBar(progress=COUNT(votes AND option=index) / COUNT(votes))
		votees := votes AND option=i
		Row(for vote in votees: Avatar(vote.author))
	if (COUNT(votes AND user=self)) Button(Retract())

Action for Retract
	delete(type=vote, author=self)

Action for Submit(i)
	send(type=vote, option=i, author=self)


registerMessageForm({
	type: 'poll',
	prompt: TextInput(),
	options: List(TextInput()),
	multiple: Checkbox(),
	anonmyous: Checkbox(),
	canRetract: Checkbox(),
})

registerView(
	msg => msg.type === 'poll',
	msg => {
		const pollId = msg.id;
		const votes = query(msg => msg.type === 'vote' && msg.poll === pollId)
		return Card(
			Row(Avatar(msg.author), Text(msg.prompt)),
			msg.options.map((option, i) => {
				const optionVotes = query(votes, msg => msg.option === i)
				const checked = any(optionVotes, msg => sentByMe(msg))
				return Column(
					Row(
						Checkbox({ checked: checked, onToggle: !checked && performAction("Submit", option) }), // what if I forget !checked?
						Text(option)
					),
					ProgressBar(optionVotes / votes.length),
					!poll.anonmyous && Row(optionVotes.map(vote => Avatar(vote.author)))
				)
			}),
			msg.canRetract && Button(performAction("Retract", pollId))
		)
	},
	{
		"Retract": pollId => remove(msg => msg.type === 'vote' && sentByMe(msg) && poll === pollId), // what if I forget the pollId?
		"Submit": option => send({ type: 'vote', option: option, author: me() }),
	}
)
```

# Explanation

```
A poll where every chat user can only vote once.
```

# Step 1

# Input

```
Input: <Msg type=poll prompt="" options=[a, b, c] multiple=false anonmyous=false canRetract=true author=user Msg type=vote option=i author=user poll=<> View for type=poll votes := type=vote AND poll=<> Text(prompt) foreach option, index in options: checked := votes AND option=i AND user=self Checkbox(Submit(index), checked=checked, readonly=checked) Text(option) ProgressBar(progress=COUNT(votes AND option=index) / COUNT(votes)) votees := votes AND option=i Row(for vote in votees: Avatar(vote.author)) if (COUNT(votes AND user=self)) Button(Retract()) Action for Retract delete(type=vote, author=self) Action for Submit(i) send(type=vote, option=i, author=self) registerMessageForm({ type: 'poll', prompt: TextInput(), options: List(TextInput()), multiple: Checkbox(), anonmyous: Checkbox(), canRetract: Checkbox(), }) registerView( msg => msg.type === 'poll', msg => { const pollId = msg.id; const votes = query(msg => msg.type === 'vote' && msg.poll === pollId) return Card( Row(Avatar(msg.author), Text(msg.prompt)), msg.options.map((option, i) => { const optionVotes = query(votes, msg => msg.option === i) const checked = any(optionVotes, msg => sentByMe(msg)) return Column( Row( Checkbox({ checked: checked, onToggle: !checked && performAction("Submit", option) }), // what if I forget !checked? Text(option) ), ProgressBar(optionVotes / votes.length), !poll.anonmyous && Row(optionVotes.map(vote => Avatar(vote.author))) ) }), msg.canRetract && Button(performAction("Retract", pollId)) ) }, { "Retract": pollId => remove(msg => msg.type === 'vote' && sentByMe(msg) && poll === pollId), // what if I forget the pollId? "Submit": option => send({ type: 'vote', option: option, author: me() }), } )> <A poll where every chat user can only vote once.> Task: Extract all explicit and implicit logical rules from the widget and description. Do not generate Python yet. Do not generate tests. Produce a single JSON object as the output, following this schema: { "widget_metadata": { "name": string|null, "description": string }, "actions": [ { "id": string, "name": string, "origin": "frontend" | "backend" | "shared" | "unknown", "parameters": [ string ], "description": string } ], "invariants": [ { "id": string, "title": string, "category": "data" | "ui" | "behavior" | "security" | "other", "expression": string, "informal": string } ], "preconditions": [ { "id": string, "action": string, "expression": string, "informal": string } ], "postconditions": [ { "id": string, "action": string, "expression": string, "informal": string } ], "safety_constraints": [ { "id": string, "expression": string, "informal": string } ], "forbidden_states": [ { "id": string, "expression": string, "informal": string } ] } Rules: - Use generic, machine-friendly IDs: e.g. "INV_DATA_RELATION_X", "PRE_SAVE_FORM_VALID", etc. - Put any formal/math-like constraints into expression. - Output MUST be valid JSON only (no extra text).
```

# Output

```
{
"widget_metadata": {
"name": null,
"description": "A poll where every chat user can only vote once."
},
"actions": [
{
"id": "ACT_CREATE_POLL",
"name": "CreatePoll",
"origin": "frontend",
"parameters": [
"prompt",
"options",
"multiple",
"anonymous",
"canRetract"
],
"description": "Create and send a new poll message with the given prompt, options, and configuration flags."
},
{
"id": "ACT_SUBMIT_VOTE",
"name": "Submit",
"origin": "frontend",
"parameters": [
"pollId",
"option"
],
"description": "Cast a vote for a given option in a specific poll as the current user."
},
{
"id": "ACT_RETRACT_VOTE",
"name": "Retract",
"origin": "frontend",
"parameters": [
"pollId"
],
"description": "Retract (delete) the current user's vote(s) for a specific poll."
}
],
"invariants": [
{
"id": "INV_DATA_POLL_TYPE",
"title": "Poll messages have type 'poll'",
"category": "data",
"expression": "forall msg: msg.type == 'poll' -> has_fields(msg, ['id','prompt','options','multiple','anonymous','canRetract','author'])",
"informal": "Every poll message is explicitly typed as 'poll' and carries an id, prompt, options list, configuration flags, and an author."
},
{
"id": "INV_DATA_POLL_OPTIONS_NONEMPTY",
"title": "Poll has at least one option",
"category": "data",
"expression": "forall poll: poll.type == 'poll' -> length(poll.options) >= 1",
"informal": "Every poll must have at least one selectable option."
},
{
"id": "INV_DATA_VOTE_TYPE_AND_LINK",
"title": "Votes are linked to polls",
"category": "data",
"expression": "forall vote: vote.type == 'vote' -> exists poll: poll.id == vote.poll && poll.type == 'poll'",
"informal": "Every vote message is of type 'vote' and references an existing poll by its id."
},
{
"id": "INV_DATA_VOTE_OPTION_IN_RANGE",
"title": "Vote option index is valid",
"category": "data",
"expression": "forall vote, poll: vote.type == 'vote' && poll.id == vote.poll -> 0 <= vote.option < length(poll.options)",
"informal": "Each vote's option index is within the bounds of the options array of the referenced poll."
},
{
"id": "INV_DATA_VOTE_AUTHOR_IS_USER",
"title": "Vote author is the sending user",
"category": "security",
"expression": "forall vote_created_by_send: vote_created_by_send.type == 'vote' -> vote_created_by_send.author == me()",
"informal": "Whenever a vote is created via the send API, its author field equals the current user."
},
{
"id": "INV_BEHAVIOR_SINGLE_VOTE_PER_USER",
"title": "Single vote per user in single-choice polls",
"category": "behavior",
"expression": "forall poll, user: poll.type == 'poll' && poll.multiple == false -> count({ v | v.type == 'vote' && v.poll == poll.id && v.author == user }) <= 1",
"informal": "For single-choice polls, each user has at most one vote for that poll."
},
{
"id": "INV_UI_CHECKBOX_REFLECTS_VOTE",
"title": "Checkbox checked state matches user's votes",
"category": "ui",
"expression": "forall poll, option_index, user: checkbox_checked(poll.id, option_index, user) <-> exists v: v.type == 'vote' && v.poll == poll.id && v.option == option_index && v.author == user",
"informal": "For each option, the checkbox is checked for a user if and only if that user has a vote for that option in that poll."
},
{
"id": "INV_UI_SINGLE_SELECTION_CHECKBOX",
"title": "At most one checked option per user in single-choice poll",
"category": "ui",
"expression": "forall poll, user: poll.type == 'poll' && poll.multiple == false -> count({ i | checkbox_checked(poll.id, i, user) }) <= 1",
"informal": "In a single-choice poll, each user sees at most one checkbox checked for that poll."
},
{
"id": "INV_UI_PROGRESS_MATCHES_VOTES",
"title": "Progress bars reflect vote distribution",
"category": "ui",
"expression": "forall poll, i: let total = count({ v | v.type == 'vote' && v.poll == poll.id }) and optVotes = count({ v | v.type == 'vote' && v.poll == poll.id && v.option == i }) in progress_bar(poll.id, i) == (total == 0 ? 0 : optVotes / total)",
"informal": "For each option, the progress bar shows the fraction of votes for that option relative to all votes, or 0 if there are no votes."
},
{
"id": "INV_UI_RETRACT_BUTTON_VISIBILITY",
"title": "Retract button visibility matches configuration and state",
"category": "ui",
"expression": "forall poll, user: retract_button_visible(poll.id, user) <-> (poll.canRetract == true && count({ v | v.type == 'vote' && v.poll == poll.id && v.author == user }) > 0)",
"informal": "The Retract button is visible for a user if and only if the poll allows retraction and that user has at least one vote in the poll."
},
{
"id": "INV_UI_ANONYMITY_VISIBILITY",
"title": "Voter identities hidden for anonymous polls",
"category": "security",
"expression": "forall poll: poll.type == 'poll' && poll.anonymous == true -> not exists v: v.type == 'vote' && v.poll == poll.id && avatar_shown(v.author, poll.id)",
"informal": "If a poll is anonymous, the UI must not display avatars or any identifying information for voters."
},
{
"id": "INV_UI_NON_ANONYMITY_VISIBILITY",
"title": "Voter identities shown only when not anonymous",
"category": "ui",
"expression": "forall poll, v: poll.type == 'poll' && poll.anonymous == false && v.type == 'vote' && v.poll == poll.id -> avatar_shown(v.author, poll.id)",
"informal": "If a poll is not anonymous, the UI shows the avatars of users who have cast a vote."
}
],
"preconditions": [
{
"id": "PRE_CREATE_POLL_OPTIONS_NONEMPTY",
"action": "ACT_CREATE_POLL",
"expression": "length(options) >= 1",
"informal": "A poll can only be created if it has at least one option."
},
{
"id": "PRE_CREATE_POLL_OPTIONS_DEFINED",
"action": "ACT_CREATE_POLL",
"expression": "forall option in options: option is non_empty_string",
"informal": "Each poll option must be a defined, non-empty text value before creating the poll."
},
{
"id": "PRE_SUBMIT_VALID_OPTION_INDEX",
"action": "ACT_SUBMIT_VOTE",
"expression": "exists poll: poll.id == pollId && 0 <= option < length(poll.options)",
"informal": "A vote can only be submitted for an existing poll and for an option index within that poll's options range."
},
{
"id": "PRE_SUBMIT_SINGLE_VOTE_POLL_NO_EXISTING_VOTE",
"action": "ACT_SUBMIT_VOTE",
"expression": "if poll.multiple == false then count({ v | v.type == 'vote' && v.poll == pollId && v.author == me() }) == 0",
"informal": "In a single-choice poll, the current user may submit a vote only if they have not already voted in that poll."
},
{
"id": "PRE_SUBMIT_USER_AUTHENTICATED",
"action": "ACT_SUBMIT_VOTE",
"expression": "me() is not null",
"informal": "Submitting a vote requires that there is a current authenticated user."
},
{
"id": "PRE_RETRACT_CAN_RETRACT",
"action": "ACT_RETRACT_VOTE",
"expression": "exists poll: poll.id == pollId && poll.canRetract == true",
"informal": "The poll must be configured to allow retraction before a retract action can be performed."
},
{
"id": "PRE_RETRACT_HAS_EXISTING_VOTE",
"action": "ACT_RETRACT_VOTE",
"expression": "count({ v | v.type == 'vote' && v.poll == pollId && v.author == me() }) > 0",
"informal": "The current user can only retract if they have at least one vote recorded for the target poll."
}
],
"postconditions": [
{
"id": "POST_CREATE_POLL_MESSAGE_CREATED",
"action": "ACT_CREATE_POLL",
"expression": "exists poll: poll.type == 'poll' && poll.prompt == prompt && poll.options == options && poll.multiple == multiple && poll.anonymous == anonymous && poll.canRetract == canRetract && poll.author == me()",
"informal": "After creating a poll, a new poll message exists with the specified prompt, options, configuration flags, and the current user as author."
},
{
"id": "POST_SUBMIT_VOTE_CREATED",
"action": "ACT_SUBMIT_VOTE",
"expression": "exists vote: vote.type == 'vote' && vote.poll == pollId && vote.option == option && vote.author == me()",
"informal": "After submitting, there is a vote message for the given poll and option authored by the current user."
},
{
"id": "POST_SUBMIT_SINGLE_VOTE_ENFORCED",
"action": "ACT_SUBMIT_VOTE",
"expression": "if poll.multiple == false then count({ v | v.type == 'vote' && v.poll == pollId && v.author == me() }) == 1",
"informal": "In a single-choice poll, after a successful submit, the current user has exactly one vote for that poll."
},
{
"id": "POST_SUBMIT_UI_UPDATED",
"action": "ACT_SUBMIT_VOTE",
"expression": "checkbox_checked(pollId, option, me()) == true && all i != option: (poll.multiple == false -> checkbox_checked(pollId, i, me()) == false) && progress_and_avatars_recomputed(pollId)",
"informal": "After submitting, the corresponding checkbox is checked for the current user, other options are unchecked in single-choice polls, and progress bars and avatars are updated to reflect the new vote counts."
},
{
"id": "POST_RETRACT_VOTES_REMOVED",
"action": "ACT_RETRACT_VOTE",
"expression": "count({ v | v.type == 'vote' && v.poll == pollId && v.author == me() }) == 0",
"informal": "After retracting, the current user has no remaining votes recorded for that poll."
},
{
"id": "POST_RETRACT_UI_UPDATED",
"action": "ACT_RETRACT_VOTE",
"expression": "forall i: checkbox_checked(pollId, i, me()) == false && progress_and_avatars_recomputed(pollId)",
"informal": "After retracting, all checkboxes for that poll are unchecked for the current user and the progress bars and avatars update to reflect the removed vote(s)."
}
],
"safety_constraints": [
{
"id": "SC_ENFORCE_SINGLE_VOTE_SERVER_SIDE",
"expression": "backend must enforce: forall poll, user: poll.multiple == false -> count({ v | v.type == 'vote' && v.poll == poll.id && v.author == user }) <= 1, regardless of frontend toggling logic",
"informal": "The backend must enforce the single-vote-per-user invariant for single-choice polls even if the UI mistakenly allows multiple Submit actions (e.g., forgetting to guard with '!checked')."
},
{
"id": "SC_RETRACT_SCOPED_TO_POLL",
"expression": "Retract(pollId) must only delete votes where v.poll == pollId and v.author == me()",
"informal": "The retract operation must be scoped to the specified poll id and the current user, so that votes in other polls or by other users are never removed, even if the pollId parameter is mishandled."
},
{
"id": "SC_ANONYMITY_ENFORCED_BACKEND",
"expression": "if poll.anonymous == true then no API or data channel used by the poll view may expose vote.author identifiers to the client",
"informal": "For anonymous polls, voter identity must be protected at the data/API layer, not just hidden in the UI."
},
{
"id": "SC_OPTION_INDEX_VALIDATION",
"expression": "backend must reject or ignore votes where vote.option is not in [0, length(poll.options) - 1]",
"informal": "The system must validate option indices server-side to prevent out-of-range options from being stored, even if the UI malfunctions."
},
{
"id": "SC_AUTH_REQUIRED_FOR_VOTE_MUTATION",
"expression": "send({ type: 'vote', ... }) and remove(... type == 'vote' ...) are only permitted when me() is a valid authenticated user",
"informal": "Only authenticated users may create or retract votes, preventing anonymous or spoofed vote mutations."
}
],
"forbidden_states": [
{
"id": "FS_MULTI_VOTES_IN_SINGLE_CHOICE",
"expression": "exists poll, user: poll.multiple == false && count({ v | v.type == 'vote' && v.poll == poll.id && v.author == user }) > 1",
"informal": "In a single-choice poll, it must never be the case that a user has more than one vote recorded."
},
{
"id": "FS_VOTE_WITHOUT_POLL",
"expression": "exists vote: vote.type == 'vote' && not exists poll: poll.id == vote.poll",
"informal": "A vote must never exist that references a poll id for which no poll message exists."
},
{
"id": "FS_VOTE_INVALID_OPTION",
"expression": "exists vote, poll: vote.type == 'vote' && poll.id == vote.poll && (vote.option < 0 || vote.option >= length(poll.options))",
"informal": "A vote must never have an option index that is out of bounds for the corresponding poll's options list."
},
{
"id": "FS_CHECKBOX_STATE_DESYNCHRONIZED",
"expression": "exists poll, user, i: checkbox_checked(poll.id, i, user) != exists v: v.type == 'vote' && v.poll == poll.id && v.option == i && v.author == user",
"informal": "The UI must never show a checkbox state that disagrees with the underlying vote data for that user, poll, and option."
},
{
"id": "FS_ANONYMOUS_POLL_SHOWS_AVATARS",
"expression": "exists poll, v: poll.anonymous == true && v.type == 'vote' && v.poll == poll.id && avatar_shown(v.author, poll.id)",
"informal": "For an anonymous poll, it must never happen that any voter's avatar or identity is displayed."
},
{
"id": "FS_RETRACT_DELETES_OTHER_USERS_VOTES",
"expression": "exists pollId, user1, user2, v: user1 != user2 && perform(Retract(pollId), user1) && v.type == 'vote' && v.poll == pollId && v.author == user2 && v.deleted == true",
"informal": "Executing a Retract action for one user must never delete votes authored by other users."
}
]
}
```

# Step 2

# Input

```
Input: <{ "widget_metadata": { "name": null, "description": "A poll where every chat user can only vote once." }, "actions": [ { "id": "ACT_CREATE_POLL", "name": "CreatePoll", "origin": "frontend", "parameters": [ "prompt", "options", "multiple", "anonymous", "canRetract" ], "description": "Create and send a new poll message with the given prompt, options, and configuration flags." }, { "id": "ACT_SUBMIT_VOTE", "name": "Submit", "origin": "frontend", "parameters": [ "pollId", "option" ], "description": "Cast a vote for a given option in a specific poll as the current user." }, { "id": "ACT_RETRACT_VOTE", "name": "Retract", "origin": "frontend", "parameters": [ "pollId" ], "description": "Retract (delete) the current user's vote(s) for a specific poll." } ], "invariants": [ { "id": "INV_DATA_POLL_TYPE", "title": "Poll messages have type 'poll'", "category": "data", "expression": "forall msg: msg.type == 'poll' -> has_fields(msg, ['id','prompt','options','multiple','anonymous','canRetract','author'])", "informal": "Every poll message is explicitly typed as 'poll' and carries an id, prompt, options list, configuration flags, and an author." }, { "id": "INV_DATA_POLL_OPTIONS_NONEMPTY", "title": "Poll has at least one option", "category": "data", "expression": "forall poll: poll.type == 'poll' -> length(poll.options) >= 1", "informal": "Every poll must have at least one selectable option." }, { "id": "INV_DATA_VOTE_TYPE_AND_LINK", "title": "Votes are linked to polls", "category": "data", "expression": "forall vote: vote.type == 'vote' -> exists poll: poll.id == vote.poll && poll.type == 'poll'", "informal": "Every vote message is of type 'vote' and references an existing poll by its id." }, { "id": "INV_DATA_VOTE_OPTION_IN_RANGE", "title": "Vote option index is valid", "category": "data", "expression": "forall vote, poll: vote.type == 'vote' && poll.id == vote.poll -> 0 <= vote.option < length(poll.options)", "informal": "Each vote's option index is within the bounds of the options array of the referenced poll." }, { "id": "INV_DATA_VOTE_AUTHOR_IS_USER", "title": "Vote author is the sending user", "category": "security", "expression": "forall vote_created_by_send: vote_created_by_send.type == 'vote' -> vote_created_by_send.author == me()", "informal": "Whenever a vote is created via the send API, its author field equals the current user." }, { "id": "INV_BEHAVIOR_SINGLE_VOTE_PER_USER", "title": "Single vote per user in single-choice polls", "category": "behavior", "expression": "forall poll, user: poll.type == 'poll' && poll.multiple == false -> count({ v | v.type == 'vote' && v.poll == poll.id && v.author == user }) <= 1", "informal": "For single-choice polls, each user has at most one vote for that poll." }, { "id": "INV_UI_CHECKBOX_REFLECTS_VOTE", "title": "Checkbox checked state matches user's votes", "category": "ui", "expression": "forall poll, option_index, user: checkbox_checked(poll.id, option_index, user) <-> exists v: v.type == 'vote' && v.poll == poll.id && v.option == option_index && v.author == user", "informal": "For each option, the checkbox is checked for a user if and only if that user has a vote for that option in that poll." }, { "id": "INV_UI_SINGLE_SELECTION_CHECKBOX", "title": "At most one checked option per user in single-choice poll", "category": "ui", "expression": "forall poll, user: poll.type == 'poll' && poll.multiple == false -> count({ i | checkbox_checked(poll.id, i, user) }) <= 1", "informal": "In a single-choice poll, each user sees at most one checkbox checked for that poll." }, { "id": "INV_UI_PROGRESS_MATCHES_VOTES", "title": "Progress bars reflect vote distribution", "category": "ui", "expression": "forall poll, i: let total = count({ v | v.type == 'vote' && v.poll == poll.id }) and optVotes = count({ v | v.type == 'vote' && v.poll == poll.id && v.option == i }) in progress_bar(poll.id, i) == (total == 0 ? 0 : optVotes / total)", "informal": "For each option, the progress bar shows the fraction of votes for that option relative to all votes, or 0 if there are no votes." }, { "id": "INV_UI_RETRACT_BUTTON_VISIBILITY", "title": "Retract button visibility matches configuration and state", "category": "ui", "expression": "forall poll, user: retract_button_visible(poll.id, user) <-> (poll.canRetract == true && count({ v | v.type == 'vote' && v.poll == poll.id && v.author == user }) > 0)", "informal": "The Retract button is visible for a user if and only if the poll allows retraction and that user has at least one vote in the poll." }, { "id": "INV_UI_ANONYMITY_VISIBILITY", "title": "Voter identities hidden for anonymous polls", "category": "security", "expression": "forall poll: poll.type == 'poll' && poll.anonymous == true -> not exists v: v.type == 'vote' && v.poll == poll.id && avatar_shown(v.author, poll.id)", "informal": "If a poll is anonymous, the UI must not display avatars or any identifying information for voters." }, { "id": "INV_UI_NON_ANONYMITY_VISIBILITY", "title": "Voter identities shown only when not anonymous", "category": "ui", "expression": "forall poll, v: poll.type == 'poll' && poll.anonymous == false && v.type == 'vote' && v.poll == poll.id -> avatar_shown(v.author, poll.id)", "informal": "If a poll is not anonymous, the UI shows the avatars of users who have cast a vote." } ], "preconditions": [ { "id": "PRE_CREATE_POLL_OPTIONS_NONEMPTY", "action": "ACT_CREATE_POLL", "expression": "length(options) >= 1", "informal": "A poll can only be created if it has at least one option." }, { "id": "PRE_CREATE_POLL_OPTIONS_DEFINED", "action": "ACT_CREATE_POLL", "expression": "forall option in options: option is non_empty_string", "informal": "Each poll option must be a defined, non-empty text value before creating the poll." }, { "id": "PRE_SUBMIT_VALID_OPTION_INDEX", "action": "ACT_SUBMIT_VOTE", "expression": "exists poll: poll.id == pollId && 0 <= option < length(poll.options)", "informal": "A vote can only be submitted for an existing poll and for an option index within that poll's options range." }, { "id": "PRE_SUBMIT_SINGLE_VOTE_POLL_NO_EXISTING_VOTE", "action": "ACT_SUBMIT_VOTE", "expression": "if poll.multiple == false then count({ v | v.type == 'vote' && v.poll == pollId && v.author == me() }) == 0", "informal": "In a single-choice poll, the current user may submit a vote only if they have not already voted in that poll." }, { "id": "PRE_SUBMIT_USER_AUTHENTICATED", "action": "ACT_SUBMIT_VOTE", "expression": "me() is not null", "informal": "Submitting a vote requires that there is a current authenticated user." }, { "id": "PRE_RETRACT_CAN_RETRACT", "action": "ACT_RETRACT_VOTE", "expression": "exists poll: poll.id == pollId && poll.canRetract == true", "informal": "The poll must be configured to allow retraction before a retract action can be performed." }, { "id": "PRE_RETRACT_HAS_EXISTING_VOTE", "action": "ACT_RETRACT_VOTE", "expression": "count({ v | v.type == 'vote' && v.poll == pollId && v.author == me() }) > 0", "informal": "The current user can only retract if they have at least one vote recorded for the target poll." } ], "postconditions": [ { "id": "POST_CREATE_POLL_MESSAGE_CREATED", "action": "ACT_CREATE_POLL", "expression": "exists poll: poll.type == 'poll' && poll.prompt == prompt && poll.options == options && poll.multiple == multiple && poll.anonymous == anonymous && poll.canRetract == canRetract && poll.author == me()", "informal": "After creating a poll, a new poll message exists with the specified prompt, options, configuration flags, and the current user as author." }, { "id": "POST_SUBMIT_VOTE_CREATED", "action": "ACT_SUBMIT_VOTE", "expression": "exists vote: vote.type == 'vote' && vote.poll == pollId && vote.option == option && vote.author == me()", "informal": "After submitting, there is a vote message for the given poll and option authored by the current user." }, { "id": "POST_SUBMIT_SINGLE_VOTE_ENFORCED", "action": "ACT_SUBMIT_VOTE", "expression": "if poll.multiple == false then count({ v | v.type == 'vote' && v.poll == pollId && v.author == me() }) == 1", "informal": "In a single-choice poll, after a successful submit, the current user has exactly one vote for that poll." }, { "id": "POST_SUBMIT_UI_UPDATED", "action": "ACT_SUBMIT_VOTE", "expression": "checkbox_checked(pollId, option, me()) == true && all i != option: (poll.multiple == false -> checkbox_checked(pollId, i, me()) == false) && progress_and_avatars_recomputed(pollId)", "informal": "After submitting, the corresponding checkbox is checked for the current user, other options are unchecked in single-choice polls, and progress bars and avatars are updated to reflect the new vote counts." }, { "id": "POST_RETRACT_VOTES_REMOVED", "action": "ACT_RETRACT_VOTE", "expression": "count({ v | v.type == 'vote' && v.poll == pollId && v.author == me() }) == 0", "informal": "After retracting, the current user has no remaining votes recorded for that poll." }, { "id": "POST_RETRACT_UI_UPDATED", "action": "ACT_RETRACT_VOTE", "expression": "forall i: checkbox_checked(pollId, i, me()) == false && progress_and_avatars_recomputed(pollId)", "informal": "After retracting, all checkboxes for that poll are unchecked for the current user and the progress bars and avatars update to reflect the removed vote(s)." } ], "safety_constraints": [ { "id": "SC_ENFORCE_SINGLE_VOTE_SERVER_SIDE", "expression": "backend must enforce: forall poll, user: poll.multiple == false -> count({ v | v.type == 'vote' && v.poll == poll.id && v.author == user }) <= 1, regardless of frontend toggling logic", "informal": "The backend must enforce the single-vote-per-user invariant for single-choice polls even if the UI mistakenly allows multiple Submit actions (e.g., forgetting to guard with '!checked')." }, { "id": "SC_RETRACT_SCOPED_TO_POLL", "expression": "Retract(pollId) must only delete votes where v.poll == pollId and v.author == me()", "informal": "The retract operation must be scoped to the specified poll id and the current user, so that votes in other polls or by other users are never removed, even if the pollId parameter is mishandled." }, { "id": "SC_ANONYMITY_ENFORCED_BACKEND", "expression": "if poll.anonymous == true then no API or data channel used by the poll view may expose vote.author identifiers to the client", "informal": "For anonymous polls, voter identity must be protected at the data/API layer, not just hidden in the UI." }, { "id": "SC_OPTION_INDEX_VALIDATION", "expression": "backend must reject or ignore votes where vote.option is not in [0, length(poll.options) - 1]", "informal": "The system must validate option indices server-side to prevent out-of-range options from being stored, even if the UI malfunctions." }, { "id": "SC_AUTH_REQUIRED_FOR_VOTE_MUTATION", "expression": "send({ type: 'vote', ... }) and remove(... type == 'vote' ...) are only permitted when me() is a valid authenticated user", "informal": "Only authenticated users may create or retract votes, preventing anonymous or spoofed vote mutations." } ], "forbidden_states": [ { "id": "FS_MULTI_VOTES_IN_SINGLE_CHOICE", "expression": "exists poll, user: poll.multiple == false && count({ v | v.type == 'vote' && v.poll == poll.id && v.author == user }) > 1", "informal": "In a single-choice poll, it must never be the case that a user has more than one vote recorded." }, { "id": "FS_VOTE_WITHOUT_POLL", "expression": "exists vote: vote.type == 'vote' && not exists poll: poll.id == vote.poll", "informal": "A vote must never exist that references a poll id for which no poll message exists." }, { "id": "FS_VOTE_INVALID_OPTION", "expression": "exists vote, poll: vote.type == 'vote' && poll.id == vote.poll && (vote.option < 0 || vote.option >= length(poll.options))", "informal": "A vote must never have an option index that is out of bounds for the corresponding poll's options list." }, { "id": "FS_CHECKBOX_STATE_DESYNCHRONIZED", "expression": "exists poll, user, i: checkbox_checked(poll.id, i, user) != exists v: v.type == 'vote' && v.poll == poll.id && v.option == i && v.author == user", "informal": "The UI must never show a checkbox state that disagrees with the underlying vote data for that user, poll, and option." }, { "id": "FS_ANONYMOUS_POLL_SHOWS_AVATARS", "expression": "exists poll, v: poll.anonymous == true && v.type == 'vote' && v.poll == poll.id && avatar_shown(v.author, poll.id)", "informal": "For an anonymous poll, it must never happen that any voter's avatar or identity is displayed." }, { "id": "FS_RETRACT_DELETES_OTHER_USERS_VOTES", "expression": "exists pollId, user1, user2, v: user1 != user2 && perform(Retract(pollId), user1) && v.type == 'vote' && v.poll == pollId && v.author == user2 && v.deleted == true", "informal": "Executing a Retract action for one user must never delete votes authored by other users." } ] }> Task: Generate: 1. A clean Python model implementing the behavior (dataclasses + pure functions). 2. A list of logical rules, referencing the IDs in the JSON spec when possible. 3. CrossHair-compatible check_* functions that: - Check each operation (action) preserves the invariants and respects constraints. - Check that no forbidden state holds. Output: Return a single JSON object with this shape: { "files": [ { "path": "widget_model.py", "language": "python", "lines": [ "line1", "line2", "..." ] } ], "logical_rules": { "invariants": [ "<id from spec>", ... ], "preconditions": [ "<id from spec>", ... ], "postconditions": [ "<id from spec>", ... ], "safety_constraints": [ "<id from spec>", ... ], "forbidden_states": [ "<id from spec>", ... ] }, "crosshair_entrypoints": [ { "name": "check_<action_name>_preserves_invariants", "kind": "operation", "operation": "<python_function_name_for_action>", "description": "Checks that <python_function_name_for_action> preserves invariants and postconditions when preconditions hold.", "related_rule_ids": [ "INV_... (for all invariants touched by this action)", "PRE_... (for this action)", "POST_... (for this action)" ] }, { "name": "check_<action_name>_respects_safety", "kind": "operation", "operation": "<python_function_name_for_action>", "description": "Checks that <python_function_name_for_action> maintains safety constraints and does not produce forbidden states.", "related_rule_ids": [ "SAFE_...", "FORBID_..." ] }, { "name": "check_state_forbidden_states", "kind": "state", "operation": null, "description": "Checks the given state against all forbidden-state predicates.", "related_rule_ids": [ "FORBID_...", "SAFE_..." ] } ] } Rules: - Derive <action_name> from spec.actions[i].name. - Map each action to one or more Python functions (e.g. apply_<action_id>). - The output MUST be valid JSON and MUST NOT contain extra commentary.
```

# Output

```
{
"files": [
{
"path": "widget_model.py",
"language": "python",
"lines": [
"from dataclasses import dataclass, field",
"from typing import Tuple, Optional, List, Set",
"",
"",
"@dataclass(frozen=True)",
"class Poll:",
"    id: int",
"    prompt: str",
"    options: Tuple[str, ...]",
"    multiple: bool",
"    anonymous: bool",
"    can_retract: bool",
"    author: Optional[str]",
"    type: str = field(default='poll')",
"",
"",
"@dataclass(frozen=True)",
"class Vote:",
"    poll: int  # poll id",
"    option: int",
"    author: str",
"    type: str = field(default='vote')",
"",
"",
"@dataclass(frozen=True)",
"class State:",
"    polls: Tuple[Poll, ...]",
"    votes: Tuple[Vote, ...]",
"",
"",
"@dataclass(frozen=True)",
"class PollView:",
"    id: int",
"    prompt: str",
"    options: Tuple[str, ...]",
"    multiple: bool",
"    anonymous: bool",
"    can_retract: bool",
"    author: Optional[str]",
"    total_votes: int",
"    option_votes: Tuple[int, ...]",
"    voter_ids: Tuple[str, ...]",
"",
"",
"def get_poll(state: State, poll_id: int) -> Optional[Poll]:",
"    for p in state.polls:",
"        if p.id == poll_id:",
"            return p",
"    return None",
"",
"",
"def checkbox_checked(state: State, poll_id: int, option_index: int, user: str) -> bool:",
"    for v in state.votes:",
"        if v.poll == poll_id and v.option == option_index and v.author == user:",
"            return True",
"    return False",
"",
"",
"def progress_bar(state: State, poll_id: int, option_index: int) -> float:",
"    total = 0",
"    opt = 0",
"    for v in state.votes:",
"        if v.poll == poll_id:",
"            total += 1",
"            if v.option == option_index:",
"                opt += 1",
"    if total == 0:",
"        return 0.0",
"    return opt / float(total)",
"",
"",
"def avatar_shown(state: State, author: str, poll_id: int) -> bool:",
"    poll = get_poll(state, poll_id)",
"    if poll is None:",
"        return False",
"    if poll.anonymous:",
"        return False",
"    for v in state.votes:",
"        if v.poll == poll_id and v.author == author:",
"            return True",
"    return False",
"",
"",
"def retract_button_visible(state: State, poll_id: int, user: str) -> bool:",
"    poll = get_poll(state, poll_id)",
"    if poll is None:",
"        return False",
"    if not poll.can_retract:",
"        return False",
"    for v in state.votes:",
"        if v.poll == poll_id and v.author == user:",
"            return True",
"    return False",
"",
"",
"def build_poll_view(state: State, poll_id: int, include_voter_ids: bool) -> Optional[PollView]:",
"    poll = get_poll(state, poll_id)",
"    if poll is None:",
"        return None",
"    total = 0",
"    option_counts: List[int] = [0 for _ in poll.options]",
"    voter_ids: List[str] = []",
"    for v in state.votes:",
"        if v.poll == poll_id:",
"            total += 1",
"            if 0 <= v.option < len(option_counts):",
"                option_counts[v.option] += 1",
"            if include_voter_ids and not poll.anonymous:",
"                voter_ids.append(v.author)",
"    if poll.anonymous:",
"        voter_ids = []",
"    return PollView(",
"        id=poll.id,",
"        prompt=poll.prompt,",
"        options=poll.options,",
"        multiple=poll.multiple,",
"        anonymous=poll.anonymous,",
"        can_retract=poll.can_retract,",
"        author=poll.author,",
"        total_votes=total,",
"        option_votes=tuple(option_counts),",
"        voter_ids=tuple(voter_ids),",
"    )",
"",
"",
"# Invariant checks",
"",
"",
"def holds_INV_DATA_POLL_TYPE(state: State) -> bool:",
"    for poll in state.polls:",
"        if poll.type != 'poll':",
"            return False",
"    for vote in state.votes:",
"        if vote.type != 'vote':",
"            return False",
"    return True",
"",
"",
"def holds_INV_DATA_POLL_OPTIONS_NONEMPTY(state: State) -> bool:",
"    for poll in state.polls:",
"        if len(poll.options) < 1:",
"            return False",
"    return True",
"",
"",
"def holds_INV_DATA_VOTE_TYPE_AND_LINK(state: State) -> bool:",
"    for vote in state.votes:",
"        if vote.type != 'vote':",
"            return False",
"        if get_poll(state, vote.poll) is None:",
"            return False",
"    return True",
"",
"",
"def holds_INV_DATA_VOTE_OPTION_IN_RANGE(state: State) -> bool:",
"    for vote in state.votes:",
"        poll = get_poll(state, vote.poll)",
"        if poll is None:",
"            return False",
"        if not (0 <= vote.option < len(poll.options)):",
"            return False",
"    return True",
"",
"",
"def holds_INV_DATA_VOTE_AUTHOR_IS_USER(state: State) -> bool:",
"    for vote in state.votes:",
"        if vote.author is None or vote.author == '':",
"            return False",
"    return True",
"",
"",
"def holds_INV_BEHAVIOR_SINGLE_VOTE_PER_USER(state: State) -> bool:",
"    for poll in state.polls:",
"        if not poll.multiple:",
"            # collect authors for this poll",
"            authors: Set[str] = set()",
"            for v in state.votes:",
"                if v.poll == poll.id:",
"                    authors.add(v.author)",
"            for a in authors:",
"                count = 0",
"                for v in state.votes:",
"                    if v.poll == poll.id and v.author == a:",
"                        count += 1",
"                if count > 1:",
"                    return False",
"    return True",
"",
"",
"def holds_INV_UI_CHECKBOX_REFLECTS_VOTE(state: State) -> bool:",
"    # For each vote, checkbox must be checked; and if checkbox is checked there must be a vote.",
"    # Since checkbox_checked is defined in terms of votes, we only need to check the equivalence explicitly.",
"    # Forward direction: votes -> checkbox",
"    for v in state.votes:",
"        if not checkbox_checked(state, v.poll, v.option, v.author):",
"            return False",
"    # Reverse direction: checkbox -> votes, for all observed users/options/polls",
"    for poll in state.polls:",
"        for v in state.votes:",
"            if v.poll == poll.id:",
"                for i in range(len(poll.options)):",
"                    if checkbox_checked(state, poll.id, i, v.author):",
"                        exists = False",
"                        for vv in state.votes:",
"                            if vv.poll == poll.id and vv.option == i and vv.author == v.author:",
"                                exists = True",
"                                break",
"                        if not exists:",
"                            return False",
"    return True",
"",
"",
"def holds_INV_UI_SINGLE_SELECTION_CHECKBOX(state: State) -> bool:",
"    for poll in state.polls:",
"        if not poll.multiple:",
"            # For each user who voted in this poll",
"            users: Set[str] = set()",
"            for v in state.votes:",
"                if v.poll == poll.id:",
"                    users.add(v.author)",
"            for u in users:",
"                checked = 0",
"                for i in range(len(poll.options)):",
"                    if checkbox_checked(state, poll.id, i, u):",
"                        checked += 1",
"                if checked > 1:",
"                    return False",
"    return True",
"",
"",
"def holds_INV_UI_PROGRESS_MATCHES_VOTES(state: State) -> bool:",
"    for poll in state.polls:",
"        total = 0",
"        opt_counts: List[int] = [0 for _ in poll.options]",
"        for v in state.votes:",
"            if v.poll == poll.id:",
"                total += 1",
"                if 0 <= v.option < len(opt_counts):",
"                    opt_counts[v.option] += 1",
"        for i in range(len(poll.options)):",
"            expected = 0.0",
"            if total != 0:",
"                expected = opt_counts[i] / float(total)",
"            if progress_bar(state, poll.id, i) != expected:",
"                return False",
"    return True",
"",
"",
"def holds_INV_UI_RETRACT_BUTTON_VISIBILITY(state: State) -> bool:",
"    for poll in state.polls:",
"        users: Set[str] = set()",
"        for v in state.votes:",
"            if v.poll == poll.id:",
"                users.add(v.author)",
"        for u in users:",
"            visible = retract_button_visible(state, poll.id, u)",
"            has_vote = False",
"            for v in state.votes:",
"                if v.poll == poll.id and v.author == u:",
"                    has_vote = True",
"                    break",
"            if visible != (poll.can_retract and has_vote):",
"                return False",
"    return True",
"",
"",
"def holds_INV_UI_ANONYMITY_VISIBILITY(state: State) -> bool:",
"    for poll in state.polls:",
"        if poll.anonymous:",
"            for v in state.votes:",
"                if v.poll == poll.id and avatar_shown(state, v.author, poll.id):",
"                    return False",
"    return True",
"",
"",
"def holds_INV_UI_NON_ANONYMITY_VISIBILITY(state: State) -> bool:",
"    for poll in state.polls:",
"        if not poll.anonymous:",
"            for v in state.votes:",
"                if v.poll == poll.id:",
"                    if not avatar_shown(state, v.author, poll.id):",
"                        return False",
"    return True",
"",
"",
"def all_invariants_hold(state: State) -> bool:",
"    return (",
"        holds_INV_DATA_POLL_TYPE(state)",
"        and holds_INV_DATA_POLL_OPTIONS_NONEMPTY(state)",
"        and holds_INV_DATA_VOTE_TYPE_AND_LINK(state)",
"        and holds_INV_DATA_VOTE_OPTION_IN_RANGE(state)",
"        and holds_INV_DATA_VOTE_AUTHOR_IS_USER(state)",
"        and holds_INV_BEHAVIOR_SINGLE_VOTE_PER_USER(state)",
"        and holds_INV_UI_CHECKBOX_REFLECTS_VOTE(state)",
"        and holds_INV_UI_SINGLE_SELECTION_CHECKBOX(state)",
"        and holds_INV_UI_PROGRESS_MATCHES_VOTES(state)",
"        and holds_INV_UI_RETRACT_BUTTON_VISIBILITY(state)",
"        and holds_INV_UI_ANONYMITY_VISIBILITY(state)",
"        and holds_INV_UI_NON_ANONYMITY_VISIBILITY(state)",
"    )",
"",
"",
"# Forbidden state checks",
"",
"",
"def violates_FS_MULTI_VOTES_IN_SINGLE_CHOICE(state: State) -> bool:",
"    for poll in state.polls:",
"        if not poll.multiple:",
"            authors: Set[str] = set()",
"            for v in state.votes:",
"                if v.poll == poll.id:",
"                    authors.add(v.author)",
"            for a in authors:",
"                count = 0",
"                for v in state.votes:",
"                    if v.poll == poll.id and v.author == a:",
"                        count += 1",
"                if count > 1:",
"                    return True",
"    return False",
"",
"",
"def violates_FS_VOTE_WITHOUT_POLL(state: State) -> bool:",
"    for v in state.votes:",
"        if get_poll(state, v.poll) is None:",
"            return True",
"    return False",
"",
"",
"def violates_FS_VOTE_INVALID_OPTION(state: State) -> bool:",
"    for v in state.votes:",
"        poll = get_poll(state, v.poll)",
"        if poll is None:",
"            return True",
"        if v.option < 0 or v.option >= len(poll.options):",
"            return True",
"    return False",
"",
"",
"def violates_FS_CHECKBOX_STATE_DESYNCHRONIZED(state: State) -> bool:",
"    # This is equivalent to the negation of INV_UI_CHECKBOX_REFLECTS_VOTE",
"    return not holds_INV_UI_CHECKBOX_REFLECTS_VOTE(state)",
"",
"",
"def violates_FS_ANONYMOUS_POLL_SHOWS_AVATARS(state: State) -> bool:",
"    for poll in state.polls:",
"        if poll.anonymous:",
"            for v in state.votes:",
"                if v.poll == poll.id and avatar_shown(state, v.author, poll.id):",
"                    return True",
"    return False",
"",
"",
"def violates_FS_RETRACT_DELETES_OTHER_USERS_VOTES(state_before: State, state_after: State, poll_id: int, me: Optional[str]) -> bool:",
"    # Check for any vote present before but missing after that does not belong to the current user or poll.",
"    for v in state_before.votes:",
"        still_there = False",
"        for vv in state_after.votes:",
"            if vv == v:",
"                still_there = True",
"                break",
"        if not still_there:",
"            # v was deleted",
"            if me is None:",
"                return True",
"            if not (v.poll == poll_id and v.author == me):",
"                return True",
"    return False",
"",
"",
"def no_forbidden_states(state: State) -> bool:",
"    return not (",
"        violates_FS_MULTI_VOTES_IN_SINGLE_CHOICE(state)",
"        or violates_FS_VOTE_WITHOUT_POLL(state)",
"        or violates_FS_VOTE_INVALID_OPTION(state)",
"        or violates_FS_CHECKBOX_STATE_DESYNCHRONIZED(state)",
"        or violates_FS_ANONYMOUS_POLL_SHOWS_AVATARS(state)",
"    )",
"",
"",
"# Safety constraint checks",
"",
"",
"def safety_single_vote_enforced(state: State) -> bool:",
"    # SC_ENFORCE_SINGLE_VOTE_SERVER_SIDE is equivalent to INV_BEHAVIOR_SINGLE_VOTE_PER_USER",
"    return holds_INV_BEHAVIOR_SINGLE_VOTE_PER_USER(state)",
"",
"",
"def safety_option_index_validation(state: State) -> bool:",
"    # SC_OPTION_INDEX_VALIDATION: all votes have valid option indices",
"    return not violates_FS_VOTE_INVALID_OPTION(state)",
"",
"",
"def safety_anonymity_enforced_backend(state: State) -> bool:",
"    # SC_ANONYMITY_ENFORCED_BACKEND: for anonymous polls, poll views expose no voter ids",
"    for poll in state.polls:",
"        if poll.anonymous:",
"            view = build_poll_view(state, poll.id, include_voter_ids=True)",
"            if view is not None and len(view.voter_ids) != 0:",
"                return False",
"    return True",
"",
"",
"def safety_state_constraints_hold(state: State) -> bool:",
"    return (",
"        safety_single_vote_enforced(state)",
"        and safety_option_index_validation(state)",
"        and safety_anonymity_enforced_backend(state)",
"    )",
"",
"",
"# Preconditions",
"",
"",
"def pre_CreatePoll(prompt: str, options: Tuple[str, ...], multiple: bool, anonymous: bool, can_retract: bool) -> bool:",
"    # PRE_CREATE_POLL_OPTIONS_NONEMPTY & PRE_CREATE_POLL_OPTIONS_DEFINED",
"    if len(options) < 1:",
"        return False",
"    for opt in options:",
"        if opt is None or opt == '':",
"            return False",
"    return True",
"",
"",
"def pre_Submit(state: State, me: Optional[str], poll_id: int, option: int) -> bool:",
"    # PRE_SUBMIT_USER_AUTHENTICATED",
"    if me is None:",
"        return False",
"    poll = get_poll(state, poll_id)",
"    # PRE_SUBMIT_VALID_OPTION_INDEX",
"    if poll is None:",
"        return False",
"    if not (0 <= option < len(poll.options)):",
"        return False",
"    # PRE_SUBMIT_SINGLE_VOTE_POLL_NO_EXISTING_VOTE",
"    if not poll.multiple:",
"        for v in state.votes:",
"            if v.poll == poll_id and v.author == me:",
"                return False",
"    return True",
"",
"",
"def pre_Retract(state: State, me: Optional[str], poll_id: int) -> bool:",
"    if me is None:",
"        return False",
"    poll = get_poll(state, poll_id)",
"    # PRE_RETRACT_CAN_RETRACT",
"    if poll is None or not poll.can_retract:",
"        return False",
"    # PRE_RETRACT_HAS_EXISTING_VOTE",
"    has_vote = False",
"    for v in state.votes:",
"        if v.poll == poll_id and v.author == me:",
"            has_vote = True",
"            break",
"    if not has_vote:",
"        return False",
"    return True",
"",
"",
"# Postconditions",
"",
"",
"def post_CreatePoll(state_before: State, state_after: State, me: Optional[str], prompt: str, options: Tuple[str, ...], multiple: bool, anonymous: bool, can_retract: bool) -> bool:",
"    # POST_CREATE_POLL_MESSAGE_CREATED",
"    for poll in state_after.polls:",
"        if (poll.prompt == prompt",
"                and poll.options == options",
"                and poll.multiple == multiple",
"                and poll.anonymous == anonymous",
"                and poll.can_retract == can_retract",
"                and poll.author == me",
"                and poll.type == 'poll'):",
"            return True",
"    return False",
"",
"",
"def post_Submit(state_before: State, state_after: State, me: Optional[str], poll_id: int, option: int) -> bool:",
"    poll = get_poll(state_after, poll_id)",
"    if poll is None:",
"        return False",
"    # POST_SUBMIT_VOTE_CREATED",
"    created = False",
"    for v in state_after.votes:",
"        if v.poll == poll_id and v.option == option and v.author == me:",
"            created = True",
"            break",
"    if not created:",
"        return False",
"    # POST_SUBMIT_SINGLE_VOTE_ENFORCED",
"    if not poll.multiple:",
"        count = 0",
"        for v in state_after.votes:",
"            if v.poll == poll_id and v.author == me:",
"                count += 1",
"        if count != 1:",
"            return False",
"    # POST_SUBMIT_UI_UPDATED",
"    if not checkbox_checked(state_after, poll_id, option, me):",
"        return False",
"    if not poll.multiple:",
"        for i in range(len(poll.options)):",
"            if i != option and checkbox_checked(state_after, poll_id, i, me):",
"                return False",
"    return True",
"",
"",
"def post_Retract(state_before: State, state_after: State, me: Optional[str], poll_id: int) -> bool:",
"    poll = get_poll(state_after, poll_id)",
"    if poll is None:",
"        return False",
"    # POST_RETRACT_VOTES_REMOVED",
"    for v in state_after.votes:",
"        if v.poll == poll_id and v.author == me:",
"            return False",
"    # POST_RETRACT_UI_UPDATED",
"    for i in range(len(poll.options)):",
"        if checkbox_checked(state_after, poll_id, i, me):",
"            return False",
"    return True",
"",
"",
"# Operations implementing actions",
"",
"",
"def op_CreatePoll(state: State, me: Optional[str], prompt: str, options: Tuple[str, ...], multiple: bool, anonymous: bool, can_retract: bool) -> State:",
"    # Purely functional: return a new state with a new poll appended.",
"    if state.polls:",
"        max_id = state.polls[0].id",
"        for p in state.polls:",
"            if p.id > max_id:",
"                max_id = p.id",
"        new_id = max_id + 1",
"    else:",
"        new_id = 0",
"    new_poll = Poll(",
"        id=new_id,",
"        prompt=prompt,",
"        options=tuple(options),",
"        multiple=multiple,",
"        anonymous=anonymous,",
"        can_retract=can_retract,",
"        author=me,",
"    )",
"    new_polls: List[Poll] = list(state.polls)",
"    new_polls.append(new_poll)",
"    return State(polls=tuple(new_polls), votes=state.votes)",
"",
"",
"def op_Submit(state: State, me: Optional[str], poll_id: int, option: int) -> State:",
"    # Enforce SC_AUTH_REQUIRED_FOR_VOTE_MUTATION",
"    if me is None:",
"        return state",
"    poll = get_poll(state, poll_id)",
"    # Enforce SC_OPTION_INDEX_VALIDATION and PRE_SUBMIT_VALID_OPTION_INDEX defensively",
"    if poll is None:",
"        return state",
"    if option < 0 or option >= len(poll.options):",
"        return state",
"    new_votes: List[Vote] = []",
"    for v in state.votes:",
"        new_votes.append(v)",
"    # SC_ENFORCE_SINGLE_VOTE_SERVER_SIDE: ensure at most one vote per user for single-choice polls",
"    if not poll.multiple:",
"        filtered: List[Vote] = []",
"        for v in new_votes:",
"            if not (v.poll == poll_id and v.author == me):",
"                filtered.append(v)",
"        new_votes = filtered",
"    new_votes.append(Vote(poll=poll_id, option=option, author=me))",
"    return State(polls=state.polls, votes=tuple(new_votes))",
"",
"",
"def op_Retract(state: State, me: Optional[str], poll_id: int) -> State:",
"    # Enforce SC_AUTH_REQUIRED_FOR_VOTE_MUTATION",
"    if me is None:",
"        return state",
"    poll = get_poll(state, poll_id)",
"    # Enforce SC_RETRACT_SCOPED_TO_POLL and PRE_RETRACT_CAN_RETRACT defensively",
"    if poll is None or not poll.can_retract:",
"        return state",
"    new_votes: List[Vote] = []",
"    for v in state.votes:",
"        if not (v.poll == poll_id and v.author == me):",
"            new_votes.append(v)",
"    return State(polls=state.polls, votes=tuple(new_votes))",
"",
"",
"# CrossHair entrypoints: invariant preservation",
"",
"",
"def check_CreatePoll_preserves_invariants(state: State, me: Optional[str], prompt: str, options: Tuple[str, ...], multiple: bool, anonymous: bool, can_retract: bool) -> None:",
"    if all_invariants_hold(state) and pre_CreatePoll(prompt, options, multiple, anonymous, can_retract):",
"        new_state = op_CreatePoll(state, me, prompt, options, multiple, anonymous, can_retract)",
"        assert all_invariants_hold(new_state)",
"        assert post_CreatePoll(state, new_state, me, prompt, options, multiple, anonymous, can_retract)",
"",
"",
"def check_Submit_preserves_invariants(state: State, me: Optional[str], poll_id: int, option: int) -> None:",
"    if all_invariants_hold(state) and pre_Submit(state, me, poll_id, option):",
"        new_state = op_Submit(state, me, poll_id, option)",
"        assert all_invariants_hold(new_state)",
"        assert post_Submit(state, new_state, me, poll_id, option)",
"",
"",
"def check_Retract_preserves_invariants(state: State, me: Optional[str], poll_id: int) -> None:",
"    if all_invariants_hold(state) and pre_Retract(state, me, poll_id):",
"        new_state = op_Retract(state, me, poll_id)",
"        assert all_invariants_hold(new_state)",
"        assert post_Retract(state, new_state, me, poll_id)",
"",
"",
"# CrossHair entrypoints: safety and forbidden states",
"",
"",
"def check_CreatePoll_respects_safety(state: State, me: Optional[str], prompt: str, options: Tuple[str, ...], multiple: bool, anonymous: bool, can_retract: bool) -> None:",
"    if no_forbidden_states(state) and safety_state_constraints_hold(state):",
"        new_state = op_CreatePoll(state, me, prompt, options, multiple, anonymous, can_retract)",
"        assert no_forbidden_states(new_state)",
"        assert safety_state_constraints_hold(new_state)",
"",
"",
"def check_Submit_respects_safety(state: State, me: Optional[str], poll_id: int, option: int) -> None:",
"    if no_forbidden_states(state) and safety_state_constraints_hold(state):",
"        new_state = op_Submit(state, me, poll_id, option)",
"        assert no_forbidden_states(new_state)",
"        assert safety_state_constraints_hold(new_state)",
"        # SC_AUTH_REQUIRED_FOR_VOTE_MUTATION: if me is None, votes must not change",
"        if me is None:",
"            assert state.votes == new_state.votes",
"",
"",
"def check_Retract_respects_safety(state: State, me: Optional[str], poll_id: int) -> None:",
"    if no_forbidden_states(state) and safety_state_constraints_hold(state):",
"        new_state = op_Retract(state, me, poll_id)",
"        assert no_forbidden_states(new_state)",
"        assert safety_state_constraints_hold(new_state)",
"        # SC_AUTH_REQUIRED_FOR_VOTE_MUTATION: if me is None, votes must not change",
"        if me is None:",
"            assert state.votes == new_state.votes",
"        # SC_RETRACT_SCOPED_TO_POLL and FS_RETRACT_DELETES_OTHER_USERS_VOTES",
"        assert not violates_FS_RETRACT_DELETES_OTHER_USERS_VOTES(state, new_state, poll_id, me)",
"",
"",
"def check_state_forbidden_states(state: State) -> None:",
"    # State-level check: no forbidden state and safety constraints hold",
"    assert no_forbidden_states(state)",
"    assert safety_state_constraints_hold(state)"
]
}
],
"logical_rules": {
"invariants": [
"INV_DATA_POLL_TYPE",
"INV_DATA_POLL_OPTIONS_NONEMPTY",
"INV_DATA_VOTE_TYPE_AND_LINK",
"INV_DATA_VOTE_OPTION_IN_RANGE",
"INV_DATA_VOTE_AUTHOR_IS_USER",
"INV_BEHAVIOR_SINGLE_VOTE_PER_USER",
"INV_UI_CHECKBOX_REFLECTS_VOTE",
"INV_UI_SINGLE_SELECTION_CHECKBOX",
"INV_UI_PROGRESS_MATCHES_VOTES",
"INV_UI_RETRACT_BUTTON_VISIBILITY",
"INV_UI_ANONYMITY_VISIBILITY",
"INV_UI_NON_ANONYMITY_VISIBILITY"
],
"preconditions": [
"PRE_CREATE_POLL_OPTIONS_NONEMPTY",
"PRE_CREATE_POLL_OPTIONS_DEFINED",
"PRE_SUBMIT_VALID_OPTION_INDEX",
"PRE_SUBMIT_SINGLE_VOTE_POLL_NO_EXISTING_VOTE",
"PRE_SUBMIT_USER_AUTHENTICATED",
"PRE_RETRACT_CAN_RETRACT",
"PRE_RETRACT_HAS_EXISTING_VOTE"
],
"postconditions": [
"POST_CREATE_POLL_MESSAGE_CREATED",
"POST_SUBMIT_VOTE_CREATED",
"POST_SUBMIT_SINGLE_VOTE_ENFORCED",
"POST_SUBMIT_UI_UPDATED",
"POST_RETRACT_VOTES_REMOVED",
"POST_RETRACT_UI_UPDATED"
],
"safety_constraints": [
"SC_ENFORCE_SINGLE_VOTE_SERVER_SIDE",
"SC_RETRACT_SCOPED_TO_POLL",
"SC_ANONYMITY_ENFORCED_BACKEND",
"SC_OPTION_INDEX_VALIDATION",
"SC_AUTH_REQUIRED_FOR_VOTE_MUTATION"
],
"forbidden_states": [
"FS_MULTI_VOTES_IN_SINGLE_CHOICE",
"FS_VOTE_WITHOUT_POLL",
"FS_VOTE_INVALID_OPTION",
"FS_CHECKBOX_STATE_DESYNCHRONIZED",
"FS_ANONYMOUS_POLL_SHOWS_AVATARS",
"FS_RETRACT_DELETES_OTHER_USERS_VOTES"
]
},
"crosshair_entrypoints": [
{
"name": "check_CreatePoll_preserves_invariants",
"kind": "operation",
"operation": "check_CreatePoll_preserves_invariants",
"description": "Checks that op_CreatePoll preserves invariants and satisfies its postconditions when preconditions hold.",
"related_rule_ids": [
"INV_DATA_POLL_TYPE",
"INV_DATA_POLL_OPTIONS_NONEMPTY",
"INV_DATA_VOTE_TYPE_AND_LINK",
"INV_DATA_VOTE_OPTION_IN_RANGE",
"INV_DATA_VOTE_AUTHOR_IS_USER",
"INV_BEHAVIOR_SINGLE_VOTE_PER_USER",
"INV_UI_CHECKBOX_REFLECTS_VOTE",
"INV_UI_SINGLE_SELECTION_CHECKBOX",
"INV_UI_PROGRESS_MATCHES_VOTES",
"INV_UI_RETRACT_BUTTON_VISIBILITY",
"INV_UI_ANONYMITY_VISIBILITY",
"INV_UI_NON_ANONYMITY_VISIBILITY",
"PRE_CREATE_POLL_OPTIONS_NONEMPTY",
"PRE_CREATE_POLL_OPTIONS_DEFINED",
"POST_CREATE_POLL_MESSAGE_CREATED"
]
},
{
"name": "check_Submit_preserves_invariants",
"kind": "operation",
"operation": "check_Submit_preserves_invariants",
"description": "Checks that op_Submit preserves invariants and satisfies its postconditions when preconditions hold.",
"related_rule_ids": [
"INV_DATA_POLL_TYPE",
"INV_DATA_POLL_OPTIONS_NONEMPTY",
"INV_DATA_VOTE_TYPE_AND_LINK",
"INV_DATA_VOTE_OPTION_IN_RANGE",
"INV_DATA_VOTE_AUTHOR_IS_USER",
"INV_BEHAVIOR_SINGLE_VOTE_PER_USER",
"INV_UI_CHECKBOX_REFLECTS_VOTE",
"INV_UI_SINGLE_SELECTION_CHECKBOX",
"INV_UI_PROGRESS_MATCHES_VOTES",
"INV_UI_RETRACT_BUTTON_VISIBILITY",
"INV_UI_ANONYMITY_VISIBILITY",
"INV_UI_NON_ANONYMITY_VISIBILITY",
"PRE_SUBMIT_VALID_OPTION_INDEX",
"PRE_SUBMIT_SINGLE_VOTE_POLL_NO_EXISTING_VOTE",
"PRE_SUBMIT_USER_AUTHENTICATED",
"POST_SUBMIT_VOTE_CREATED",
"POST_SUBMIT_SINGLE_VOTE_ENFORCED",
"POST_SUBMIT_UI_UPDATED"
]
},
{
"name": "check_Retract_preserves_invariants",
"kind": "operation",
"operation": "check_Retract_preserves_invariants",
"description": "Checks that op_Retract preserves invariants and satisfies its postconditions when preconditions hold.",
"related_rule_ids": [
"INV_DATA_POLL_TYPE",
"INV_DATA_POLL_OPTIONS_NONEMPTY",
"INV_DATA_VOTE_TYPE_AND_LINK",
"INV_DATA_VOTE_OPTION_IN_RANGE",
"INV_DATA_VOTE_AUTHOR_IS_USER",
"INV_BEHAVIOR_SINGLE_VOTE_PER_USER",
"INV_UI_CHECKBOX_REFLECTS_VOTE",
"INV_UI_SINGLE_SELECTION_CHECKBOX",
"INV_UI_PROGRESS_MATCHES_VOTES",
"INV_UI_RETRACT_BUTTON_VISIBILITY",
"INV_UI_ANONYMITY_VISIBILITY",
"INV_UI_NON_ANONYMITY_VISIBILITY",
"PRE_RETRACT_CAN_RETRACT",
"PRE_RETRACT_HAS_EXISTING_VOTE",
"POST_RETRACT_VOTES_REMOVED",
"POST_RETRACT_UI_UPDATED"
]
},
{
"name": "check_CreatePoll_respects_safety",
"kind": "operation",
"operation": "check_CreatePoll_respects_safety",
"description": "Checks that op_CreatePoll maintains safety constraints and does not produce forbidden states.",
"related_rule_ids": [
"SC_ENFORCE_SINGLE_VOTE_SERVER_SIDE",
"SC_RETRACT_SCOPED_TO_POLL",
"SC_ANONYMITY_ENFORCED_BACKEND",
"SC_OPTION_INDEX_VALIDATION",
"SC_AUTH_REQUIRED_FOR_VOTE_MUTATION",
"FS_MULTI_VOTES_IN_SINGLE_CHOICE",
"FS_VOTE_WITHOUT_POLL",
"FS_VOTE_INVALID_OPTION",
"FS_CHECKBOX_STATE_DESYNCHRONIZED",
"FS_ANONYMOUS_POLL_SHOWS_AVATARS",
"FS_RETRACT_DELETES_OTHER_USERS_VOTES"
]
},
{
"name": "check_Submit_respects_safety",
"kind": "operation",
"operation": "check_Submit_respects_safety",
"description": "Checks that op_Submit maintains safety constraints and does not produce forbidden states.",
"related_rule_ids": [
"SC_ENFORCE_SINGLE_VOTE_SERVER_SIDE",
"SC_RETRACT_SCOPED_TO_POLL",
"SC_ANONYMITY_ENFORCED_BACKEND",
"SC_OPTION_INDEX_VALIDATION",
"SC_AUTH_REQUIRED_FOR_VOTE_MUTATION",
"FS_MULTI_VOTES_IN_SINGLE_CHOICE",
"FS_VOTE_WITHOUT_POLL",
"FS_VOTE_INVALID_OPTION",
"FS_CHECKBOX_STATE_DESYNCHRONIZED",
"FS_ANONYMOUS_POLL_SHOWS_AVATARS",
"FS_RETRACT_DELETES_OTHER_USERS_VOTES"
]
},
{
"name": "check_Retract_respects_safety",
"kind": "operation",
"operation": "check_Retract_respects_safety",
"description": "Checks that op_Retract maintains safety constraints and does not produce forbidden states.",
"related_rule_ids": [
"SC_ENFORCE_SINGLE_VOTE_SERVER_SIDE",
"SC_RETRACT_SCOPED_TO_POLL",
"SC_ANONYMITY_ENFORCED_BACKEND",
"SC_OPTION_INDEX_VALIDATION",
"SC_AUTH_REQUIRED_FOR_VOTE_MUTATION",
"FS_MULTI_VOTES_IN_SINGLE_CHOICE",
"FS_VOTE_WITHOUT_POLL",
"FS_VOTE_INVALID_OPTION",
"FS_CHECKBOX_STATE_DESYNCHRONIZED",
"FS_ANONYMOUS_POLL_SHOWS_AVATARS",
"FS_RETRACT_DELETES_OTHER_USERS_VOTES"
]
},
{
"name": "check_state_forbidden_states",
"kind": "state",
"operation": null,
"description": "Checks the given state against all forbidden-state predicates and state-level safety constraints.",
"related_rule_ids": [
"SC_ENFORCE_SINGLE_VOTE_SERVER_SIDE",
"SC_RETRACT_SCOPED_TO_POLL",
"SC_ANONYMITY_ENFORCED_BACKEND",
"SC_OPTION_INDEX_VALIDATION",
"SC_AUTH_REQUIRED_FOR_VOTE_MUTATION",
"FS_MULTI_VOTES_IN_SINGLE_CHOICE",
"FS_VOTE_WITHOUT_POLL",
"FS_VOTE_INVALID_OPTION",
"FS_CHECKBOX_STATE_DESYNCHRONIZED",
"FS_ANONYMOUS_POLL_SHOWS_AVATARS",
"FS_RETRACT_DELETES_OTHER_USERS_VOTES"
]
}
]
}

```

# Step 3

```
"No counterexamples found."
```

# Step 4

# Input

```
Input:
<"No counterexamples found.">
<...>
<...>

Task:
Interpret the verification results and produce a structured diagnostic report.

Output:
Return a single JSON object:

{
  "status": "ok" | "failed",
  "summary": string,
  "issues": [
    {
      "id": string,
      "kind": "invariant" | "precondition" | "postcondition" | "safety" | "forbidden_state" | "other",
      "rule_id": string | null,
      "rule_expression": string | null,
      "crosshair_function": string,
      "failing_inputs": {
        "raw": string,
        "parsed": object|null
      },
      "explanation": string,
      "suggested_fix_model": {
        "description": string,
        "patch_hint": string
      },
      "suggested_fix_widget": {
        "description": string,
        "patch_hint": string
      }
    }
  ]
}

Rules:
- If CrossHair reports “No counterexamples found.” then:
  - status = "ok"
  - issues = []
  - summary explains that no logical problems were detected.
- For each counterexample CrossHair reports:
  - Create one entry in `issues`.
  - Populate `rule_id` by matching against the logical rule IDs when possible; otherwise null.
  - Put the raw counterexample text into `failing_inputs.raw`.
- The output MUST be valid JSON and MUST NOT contain extra commentary.

```

# Output

```
{
"status": "ok",
"summary": "CrossHair reported 'No counterexamples found.', indicating that under its explored input space all specified invariants, preconditions, postconditions, safety constraints, and forbidden-state checks for the poll widget implementation held with no logical violations detected.",
"issues": []
}
```
