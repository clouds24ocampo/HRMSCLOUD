// Psychological exam: no right or wrong answers, only how well each choice fits a dependable, team-minded worker.
// Each question: [trait, scenario, choice, choice, choice, choice], written best fit first. Points 4, 3, 1, 0 go in that
// order; the seed script mixes the order shown to the applicant. 10 traits x 3 questions = 30 questions, 120 points.
export type PsychQ = [string, string, string, string, string, string];
export const PSYCH_POINTS = [4, 3, 1, 0] as const;

export const PSYCH: PsychQ[] = [
  // Teamwork
  ["Teamwork", "Your team is behind schedule and a co-worker is overloaded. You have finished your own tasks. What would you most likely do?", "Offer to take part of their work and tell the team lead", "Wait to be asked before helping", "Tell the co-worker to work faster", "Go on break since your work is done"],
  ["Teamwork", "A teammate's idea differs from yours and the group prefers theirs. What would you most likely do?", "Support the group's choice and help make it work", "Go along but stay quietly unhappy", "Keep arguing for your idea", "Do your own version anyway"],
  ["Teamwork", "A teammate takes credit for work you did together. What would you most likely do?", "Talk to them privately, then raise it with the lead if it continues", "Say nothing and let it go", "Complain about them to other co-workers", "Stop cooperating with them"],
  // Integrity
  ["Integrity", "You notice you were paid more than you should have been. What would you most likely do?", "Report it to payroll or HR right away", "Wait to see if anyone notices", "Keep it since the company can afford it", "Tell a friend and keep quiet"],
  ["Integrity", "Your supervisor asks you to mark a co-worker as present when they are absent. What would you most likely do?", "Politely refuse and suggest the proper way to record it", "Do it this one time", "Do it and ask for a favor in return", "Do it and tell no one"],
  ["Integrity", "You accidentally damage a company tool and nobody saw it. What would you most likely do?", "Report it honestly to your supervisor", "Hide it and hope nobody checks", "Blame the previous user", "Quietly replace it later without telling anyone"],
  // Reliability
  ["Reliability", "You are asked to finish a report by Friday but a personal problem comes up. What would you most likely do?", "Tell your supervisor early and agree on a clear plan to deliver", "Do your best and hope it is fine", "Submit it late without saying anything", "Ask a co-worker to do it silently"],
  ["Reliability", "You wake up tired on a day you have an important shift. What would you most likely do?", "Go to work on time as scheduled", "Go to work an hour late", "Call in sick without a real reason", "Skip the shift and not tell anyone"],
  ["Reliability", "You agreed to help a co-worker after work, but you now want to go out with friends. What would you most likely do?", "Keep your promise or politely ask to move it in good time", "Cancel at the last minute", "Show up late and leave early", "Avoid their messages"],
  // Stress tolerance
  ["Stress tolerance", "Several urgent tasks arrive at once and the deadline is today. What would you most likely do?", "List the tasks, prioritize and ask for help where needed", "Do the easiest first", "Panic and freeze", "Complain and give up"],
  ["Stress tolerance", "A customer shouts at you in front of others. What would you most likely do?", "Stay calm, listen and look for a way to help", "Shout back", "Walk away", "Laugh at them"],
  ["Stress tolerance", "You made a serious mistake and your supervisor is angry. What would you most likely do?", "Take responsibility, listen and work on fixing it", "Make excuses", "Argue and blame others", "Take a leave of absence"],
  // Initiative
  ["Initiative", "You finish your tasks early and see nothing else assigned. What would you most likely do?", "Ask your supervisor what else needs doing or improve something useful", "Wait until someone gives you work", "Use the time for personal activities", "Hide so you are not given more work"],
  ["Initiative", "You notice a repeated problem in your process that wastes time. What would you most likely do?", "Suggest a practical fix to your supervisor", "Ignore it, it is not your job", "Complain to co-workers", "Hope someone else will fix it"],
  ["Initiative", "A teammate leaves a task unfinished when their shift ends. What would you most likely do?", "Check with the lead and help finish or hand it over properly", "Leave it for the next day", "Blame the teammate loudly", "Pretend you did not notice"],
  // Adaptability
  ["Adaptability", "Your schedule or tasks suddenly change because of a company decision. What would you most likely do?", "Adjust, ask questions and make the new setup work", "Accept it but resist quietly", "Refuse until someone convinces you", "Resign immediately"],
  ["Adaptability", "You are assigned to a new team with different working styles. What would you most likely do?", "Observe, learn their ways and adjust while sharing your own strengths", "Insist they follow your way", "Avoid them", "Ask to be moved back immediately"],
  ["Adaptability", "A new system replaces the one you know well. What would you most likely do?", "Attend the training and practice until you are confident", "Use it only when forced", "Keep using the old way secretly", "Complain that the old one was better"],
  // Communication
  ["Communication", "You do not understand your supervisor's instruction. What would you most likely do?", "Ask politely for clarification and repeat back what you understood", "Guess what they meant", "Ask a co-worker to guess", "Do nothing"],
  ["Communication", "You need to give a co-worker feedback about a mistake. What would you most likely do?", "Speak privately, calmly and focus on how to fix it", "Point it out in front of everyone", "Say nothing and let them fail", "Send an angry message"],
  ["Communication", "You will be late because of a traffic jam. What would you most likely do?", "Inform your supervisor as soon as you know", "Say nothing and explain later", "Send a message only after arriving", "Pretend you were on time"],
  // Service orientation
  ["Service orientation", "A customer asks for something you cannot provide. What would you most likely do?", "Explain kindly and offer the best alternative or refer them properly", "Say 'not my job'", "Ignore the request", "Promise something you cannot deliver"],
  ["Service orientation", "A customer complains about a service you were not involved in. What would you most likely do?", "Listen, apologize for the experience and pass it to the right person", "Say it is not your fault", "Argue about the facts", "Walk away"],
  ["Service orientation", "A co-worker from another department asks for help while you are busy. What would you most likely do?", "Tell them when you can help or point them to the right person", "Say you are too busy and leave", "Ignore them", "Tell them to ask someone else, rudely"],
  // Safety mindset
  ["Safety mindset", "A co-worker is not wearing the required protective equipment. What would you most likely do?", "Remind them politely and report it if they refuse", "Ignore it, it is their business", "Laugh at them", "Take a photo and post it"],
  ["Safety mindset", "You are in a hurry and the safe way takes longer. What would you most likely do?", "Follow the safe procedure even if it takes longer", "Skip a step this once", "Skip steps if the supervisor is away", "Do whatever is fastest"],
  ["Safety mindset", "You see a spill or loose cable in a walkway. What would you most likely do?", "Mark or fix it right away and report it", "Step around it", "Wait for the janitor", "Ignore it, someone will notice"],
  // Learning agility
  ["Learning agility", "You receive critical feedback about your work. What would you most likely do?", "Thank them, reflect and improve", "Defend yourself right away", "Feel offended and stop talking", "Ignore it"],
  ["Learning agility", "You are asked to do a task you have never done before. What would you most likely do?", "Ask for guidance, study the steps and try carefully", "Say you cannot do it", "Pretend you know and do it carelessly", "Pass it to someone else"],
  ["Learning agility", "Your company offers free training outside your usual duties. What would you most likely do?", "Join and apply what you learn", "Skip it, you are fine already", "Join only if forced", "Ask for pay for attending"],
];
