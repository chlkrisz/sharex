import axios from "axios";

export const getDiscordProfilePicture = async (id: string) => {
  if (!id) throw new Error("Bad Request");

  try {
    const response = await axios.get(`https://discord.com/api/v9/users/${id}`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN || ""}` },
    });
    let json = response.data;
    if (!json.avatar) throw new Error("The Discord user doesn't have a profile picture set!");

    const image = await axios.get(
      `https://cdn.discordapp.com/avatars/${id}/${json.avatar}.png?size=1024`,
      { responseType: "stream" }
    );

    return image.data;
  } catch (error) {
    throw new Error("The Discord user doesn't exist!");
  }
};
