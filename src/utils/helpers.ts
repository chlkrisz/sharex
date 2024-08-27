import crypto from "crypto";

export const generatePassword = (length = 32) => {
  const lowerCase = "abcdefghijklmnopqrstuvwxyz";
  const upperCase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  let password = [
    lowerCase[Math.floor(Math.random() * lowerCase.length)],
    upperCase[Math.floor(Math.random() * upperCase.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
  ];
  const allChars = lowerCase + upperCase + numbers;
  for (let i = password.length; i < length; i++) {
    const randomIndex = crypto.randomInt(0, allChars.length);
    password.push(allChars[randomIndex]);
  }
  return password.join("");
};