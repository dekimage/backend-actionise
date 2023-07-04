"use strict";
const fs = require("fs");
const path = require("path");
const { createCoreController } = require("@strapi/strapi").factories;
const { createToken } = require("../../../../utils/functions");
const bcrypt = require("bcryptjs");
// @CALC
const maxProgressPerContentType = {
  ideas: 3,
  actions: 5,
  stories: 1,
  faq: 2,
  program: 3,
  casestudy: 1,
  tips: 3,
  metaphors: 3,
  experiments: 2,
  expertOpinions: 3,
  quotes: 5,
  questions: 3,
};
function singularize(word) {
  switch (word) {
    case "ideas":
      return "idea";
    case "actions":
      return "exercise";
    case "stories":
      return "story";
    case "faq":
      return "faq"; // this is already singular
    case "program":
      return "program"; // this is already singular
    case "casestudy":
      return "casestudy"; // this is already singular
    case "tips":
      return "tip";
    case "metaphors":
      return "metaphore";
    case "experiments":
      return "experiment";
    case "expertOpinions":
      return "expertopinion";
    case "quotes":
      return "quote";
    case "questions":
      return "question";
    default:
      return false;
  }
}
const sanitizeUser = (user) => {
  delete user["provider"];
  delete user["password"];
  delete user["reset_password_token"];
  delete user["resetPasswordToken"];
  delete user["confirmationToken"];
  delete user["confirmed"];
  delete user["blocked"];
  delete user["updatedAt"];
  delete user["createdAt"];
  return user;
};
const formatDate = (date) => {
  const padTo2Digits = (num) => {
    return num.toString().padStart(2, "0");
  };
  return [
    date.getFullYear(),
    padTo2Digits(date.getMonth() + 1),
    padTo2Digits(date.getDate()),
  ].join("-");
};
const getUserCard = async (userId, cardId) => {
  const userCardRelation = await strapi
    .query("api::usercard.usercard")
    .findOne({ where: { user: userId, card: cardId } });
  return userCardRelation;
};
const getUser = async (id, populate = {}) => {
  const defaultPopulate = {
    usercards: true,
    orders: true,
  };
  const entry = await strapi.db
    .query("plugin::users-permissions.user")
    .findOne({
      // select: ['title', 'description'],
      where: { id: id },
      populate: { ...defaultPopulate, ...populate },
    });
  return sanitizeUser(entry);
};
const updateUser = async (id, payload, populate = {}) => {
  const defaultPopulate = { usercards: true, orders: true };
  const user = await strapi.db.query("plugin::users-permissions.user").update({
    where: { id: id },
    data: payload,
    populate: { ...defaultPopulate, ...populate },
  });

  return sanitizeUser(user);
};
const getOrCreateUserCard = async (ctx, userId, card) => {
  const checkUserCardRelation = await strapi.db
    .query("api::usercard.usercard")
    .findOne({ where: { user: userId, card: card.id } });
  if (!checkUserCardRelation && card.is_open) {
    const newUserCardRelation = await strapi.db
      .query("api::usercard.usercard")
      .create({
        data: {
          user: userId,
          card: card.id,
          completed: 0,
          is_unlocked: true,
          is_new: true,
          completed_contents: [],
          progressMap: {},
          progressQuest: {},
        },
      });
    return newUserCardRelation;
  }
  if (!checkUserCardRelation && !card.is_open) {
    ctx.throw(403, "You have not unlocked this card yet");
  }
  return checkUserCardRelation;
};
module.exports = createCoreController(
  "api::usercard.usercard",
  ({ strapi }) => ({
    // DEV TOOLBOX
    async resetUser(ctx) {
      const user = ctx.state.user;
      let payload = {
        level: 1,
        xp: 0,
        stars: 10000,
        energy: 1000,
        streak: 100,
        highest_buddy_shares: 10,
        is_notify_me: false,
        objectives_json: {
          1: { progress: 15, isCollected: false },
          2: { progress: 15, isCollected: false },
          3: { progress: 15, isCollected: false },
          4: { progress: 15, isCollected: false },
          5: { progress: 15, isCollected: false },
          6: { progress: 15, isCollected: false },
          7: { progress: 15, isCollected: false },
          8: { progress: 15, isCollected: false },
        },
        stats: {
          mastery: 0,
          card_unlock: 0,
          cards_complete: 0,
          action_complete: 0,
          claimed_artifacts: 0,
          daily_objectives_complete: 0,
          weekly_objectives_complete: 0,
        },
        droppedContent: {},
        unlocked_cards: {},
        avatar: 1,
        artifacts: [],
        claimed_artifacts: [],
        favorite_cards: [],
        tutorial_step: 0,
        shared_by: [],
        shared_buddies: [],
        last_unlocked_cards: [],
        last_completed_cards: [],
        streak_rewards: {},
        friends_rewards: {},
        rewards_tower: {},
      };
      const data = updateUser(user.id, payload);
      //delete all usercards WARNING!!!
      // WORKAROUND FOR STRAPI QUERY FIRST (find all) THEN DELETE (delete many) -> https://github.com/strapi/strapi/issues/11998
      const toDelete = await strapi.db
        .query("api::usercard.usercard")
        .findMany({ where: { user: user.id } });
      await strapi.db
        .query("api::usercard.usercard")
        .deleteMany({ where: { id: { $in: toDelete.map(({ id }) => id) } } });

      return data;
    },
    async updateContentType(ctx) {
      const { action, contentType, contentTypeId, cardId } = ctx.request.body;

      console.log(action, contentType, contentTypeId, cardId);

      const propertyName = `saved${contentType
        .charAt(0)
        .toUpperCase()}${contentType.slice(1)}`;

      const user = await getUser(ctx.state.user.id, {
        [propertyName]: true,
        last_completed_cards: true,
      });

      console.log(user.username);

      const contentTypeIdParsed = parseInt(contentTypeId);

      const isValidContentType = (contentType) =>
        contentType in maxProgressPerContentType ? true : false;

      if (!isValidContentType(contentType)) {
        ctx.throw(400, "Invalid content type");
      }

      const formattedContentType = singularize(contentType);
      const contentTypeData =
        action == "claim"
          ? { isOpen: true }
          : await strapi.db
              .query(`api::${formattedContentType}.${formattedContentType}`)
              .findOne({
                where: { id: contentTypeId },
              });

      const card = await strapi.db.query("api::card.card").findOne({
        where: {
          id: cardId,
        },
      });

      let userCard = await getOrCreateUserCard(ctx, ctx.state.user.id, card);

      let progressMap = userCard?.progressMap || {};

      if (!progressMap[contentType]) {
        progressMap[contentType] = {};
      }

      if (!progressMap[contentType][contentTypeId]) {
        if (contentTypeData.isOpen) {
          progressMap[contentType][contentTypeId] = {
            completed: 0,
            saved: false,
          };
        } else {
          return ctx.throw(403, "You haven't unlocked this content yet.");
        }
      }

      if (action == "save") {
        // BOOKMARK IN RELATION IN USER
        let newSavedContent = user[propertyName] || [];

        const alreadySaved =
          newSavedContent.length > 0 &&
          newSavedContent.filter((c) => c.id == contentTypeIdParsed).length > 0;

        if (alreadySaved) {
          newSavedContent = newSavedContent.filter(
            (c) => c.id != contentTypeIdParsed
          );
        } else {
          newSavedContent.push(contentTypeIdParsed);
        }

        const userUpdate = {
          [propertyName]: newSavedContent,
        };

        const userData = updateUser(user.id, userUpdate);

        // BOOKMARK IN PROGRESSMAP IN USERCARD

        progressMap[contentType][contentTypeId] = {
          ...progressMap[contentType][contentTypeId],
          saved: !progressMap[contentType][contentTypeId].saved,
        };

        // SAVE USERCARD - PROGRESSMAP

        await strapi.db.query("api::usercard.usercard").update({
          where: { id: userCard.id },
          data: {
            progressMap,
          },
        });

        return userData;
      }

      if (action == "complete") {
        // check 24 hours
        // const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        // if (
        //   Date.now() -
        //     userCard.progressMap[contentType][contentTypeId].lastTime <
        //   oneDay
        // ) {
        //   return ctx.throw(
        //     400,
        //     "You need to wait 24 hours before updating progress again."
        //   );
        // }

        // check energy
        if (user.energy < 1) {
          return ctx.throw(400, "You don't have enough energy.");
        }

        // LAST COMPLETED UPDATE + energy reduce
        let new_last_completed = user.last_completed_cards;
        new_last_completed.push(cardId);
        if (new_last_completed.length > 10) {
          new_last_completed.shift();
        }
        const payload = {
          last_completed_cards: new_last_completed,
          energy: user.energy - 1,
        };
        await updateUser(user.id, payload);

        if (
          progressMap[contentType][contentTypeId].completed <
          maxProgressPerContentType[contentType]
        ) {
          progressMap[contentType][contentTypeId] = {
            completed: progressMap[contentType][contentTypeId].completed + 1,
            lastTime: Date.now(),
          };
        } else {
          ctx.throw(400, "You have already completed this content type.");
        }

        // update the PROGRESSQUEST

        // Initialize progressQuest if it's not defined
        // let progressQuest = userCard.progressQuest ?? {};
        let progressQuest =
          userCard.progressQuest == null ? {} : userCard.progressQuest;
        progressQuest[contentType] = progressQuest[contentType] ?? {
          level: 1,
          progress: 0,
          claimsAvailable: 0,
        };

        // Check if progress is already at the maximum for this contentType
        if (
          progressQuest[contentType].progress >=
          maxProgressPerContentType[contentType]
        ) {
          // If progress is at maximum, reset progress to 1 and increment level
          progressQuest[contentType].progress = 1;
          progressQuest[contentType].level++;
        } else {
          // If progress is not at maximum, increment progress
          progressQuest[contentType].progress++;
        }

        userCard = await strapi.db.query("api::usercard.usercard").update({
          where: { id: userCard.id },
          data: {
            progressMap,
            progressQuest,
          },
        });

        await strapi
          .service("api::usercard.usercard")
          .objectivesTrigger(user, "energy");

        // ACHIEVEMENTS UPDATE??

        ctx.send(userCard);
      }

      if (action == "claim") {
        let progressQuest = userCard.progressQuest;

        if (!progressQuest) {
          return ctx.throw(400, "You have not completed any content yet.");
        }
        if (progressQuest[contentType].claimsAvailable < 1) {
          return ctx.throw(400, "You have already claimed this quest.");
        }
        // claim quest
        progressQuest[contentType].claimsAvailable--;

        // ROLL RANDOM CONTENT TYPE
        const randomReward = await strapi
          .service("api::usercard.usercard")
          .getRandomUndroppedContent(user);

        const { reward, rewardType, error } = randomReward;
        if (error) {
          ctx.throw(400, "No rewards available.");
        }

        const formattedContentType = singularize(rewardType);

        const cardFromReward = await strapi.entityService.findOne(
          `api::${formattedContentType}.${formattedContentType}`,
          reward.id,
          {
            fields: ["id"],
            populate: { card: true },
          }
        );

        const usercardFromReward = await getOrCreateUserCard(
          ctx,
          ctx.state.user.id,
          cardFromReward.card
        );

        // UPDATE PROGRESSMAP IN USERCARD WHERE REWARD DROPPED ->
        let progressMapFromReward = usercardFromReward.progressMap || {};

        if (!progressMapFromReward[rewardType]) {
          progressMapFromReward[rewardType] = {};
        }

        progressMapFromReward[rewardType][reward.id] = {
          completed: 0,
          saved: false,
        };

        strapi.entityService.update(
          "api::usercard.usercard",
          usercardFromReward.id,
          {
            data: {
              progressMap: progressMapFromReward,
            },
          }
        );

        // UPDATE DROPPEDCONTENT JSON IN USER ->
        const droppedContent = user.droppedContent || {};

        const userUpdate = {
          stars: user.energy + 50,
          xp: user.xp + 100,

          droppedContent: {
            ...droppedContent,
            [rewardType]: droppedContent[rewardType]
              ? [...droppedContent[rewardType], reward.id]
              : [reward.id],
          },
        };

        const userData = updateUser(user.id, userUpdate);

        // UPDATE THE PROGRESS QUEST IN THE ORIGINAL USERCARD ->
        userCard = await strapi.db.query("api::usercard.usercard").update({
          where: { id: userCard.id },
          data: {
            progressQuest,
          },
        });

        return reward;
      }
    },

    // SETTINGS
    async updateEmailSettings(ctx) {
      const user = await getUser(ctx.state.user.id);
      const { settings } = ctx.request.body;
      // Validate the email_preferences object
      if (typeof email_preferences !== "object" || email_preferences === null) {
        ctx.throw(400, "Invalid email preferences object");
      }

      const allowedKeys = [
        "newsletter",
        "promotions",
        "content",
        "updates",
        "reminders",
        "unsubscribe",
      ];

      // Check if the keys in email_preferences are valid
      for (const key in email_preferences) {
        if (!allowedKeys.includes(key)) {
          ctx.throw(400, `Invalid email preferences key: ${key}`);
        }
      }

      // Check if the values are booleans
      for (const key in email_preferences) {
        if (typeof email_preferences[key] !== "boolean") {
          ctx.throw(400, `Invalid value for email preference: ${key}`);
        }
      }

      const payload = {
        email_preferences: settings,
      };

      await updateUser(user.id, payload);

      return { success: true };
    },

    async updateUserBasicInfo(ctx) {
      const user = await getUser(ctx.state.user.id);
      const { value, inputName } = ctx.request.body;
      if (!value || !inputName) {
        ctx.throw(400, "invalid input");
      }
      if (
        inputName !== "username" &&
        inputName !== "age" &&
        inputName !== "gender"
      ) {
        ctx.throw(400, "invalid input");
      }
      const payload = {
        [inputName]: value,
      };
      const data = updateUser(user.id, payload);
      return data;
    },

    async resetUser(ctx) {
      const user = ctx.state.user;
      let payload = {
        objectives_json: {
          1: { progress: 5, isCollected: false },
          2: { progress: 5, isCollected: false },
          3: { progress: 5, isCollected: false },
          4: { progress: 5, isCollected: false },
          5: { progress: 5, isCollected: false },
          6: { progress: 5, isCollected: false },
          7: { progress: 5, isCollected: false },
          8: { progress: 5, isCollected: false },
        },
        streak_rewards: {},
        friends_rewards: {},
        rewards_tower: {},
      };
      const data = updateUser(user.id, payload);
      return data;
    },

    async notifyMe(ctx) {
      const user = await getUser(ctx.state.user.id);
      const isNotifyMe = ctx.request.body.isNotifyMe;
      if (typeof isNotifyMe !== "boolean") {
        ctx.throw(400, "invalid input, must be boolean");
      }
      const upload = {
        is_notify_me: isNotifyMe,
      };

      await updateUser(user.id, upload);
      return { success: true };
    },

    async rateCard(ctx) {
      const availableRatings = [1, 2, 3, 4, 5, 6, 7, 8];
      const user = await getUser(ctx.state.user.id);
      const rating = ctx.request.body.rating;
      const cardId = parseInt(ctx.request.body.cardId);
      const feedbackType = ctx.request.body.feedbackType;
      let upload;
      let hasRated = false;

      if (feedbackType !== "message" && feedbackType !== "rating") {
        ctx.throw(400, "invalid input, must be proper feedback type");
      }

      const usercard = await getUserCard(user.id, cardId);

      if (!usercard) {
        ctx.throw(400, "invalid card, you don't have this card unlocked yet");
      }
      // IF RATING
      if (feedbackType === "rating") {
        if (typeof rating !== "number" && !availableRatings.includes(rating)) {
          ctx.throw(400, "invalid input, must be proper rating number");
        }
        upload = {
          rating: rating,
        };
      }
      // IF MESSAGE
      if (feedbackType === "message") {
        upload = {
          message: rating,
          isRated: true,
        };
      }

      if (!usercard.isRated) {
        await strapi
          .service("api::usercard.usercard")
          .gainReward(user, "stars", 25);
        hasRated = true;
      }

      const usercardUpdated = await strapi.db
        .query("api::usercard.usercard")
        .update({
          where: { user: user.id, card: cardId },
          data: upload,
        });

      return { usercard: usercardUpdated, hasRated };
    },

    async acceptReferral(ctx) {
      const user = await getUser(ctx.state.user.id, { shared_by: true });
      // update self
      if (user.is_referral_accepted) {
        ctx.throw(400, "You already claimed this reward");
      }
      const upload = {
        is_referral_accepted: true,
        stars: user.stars + 400,
      };

      await updateUser(user.id, upload);

      const sharedUserId = user.shared_by.id;
      console.log(sharedUserId);

      const sharedUser = await getUser(sharedUserId, { shared_buddies: true });

      // update the shared user
      const sharedUpload = {
        highest_buddy_shares: sharedUser.highest_buddy_shares + 1,
        // shared_buddies: [...sharedUser.shared_buddies, sharedUserId],
      };

      await updateUser(sharedUserId, sharedUpload);
      return { success: true };
    },

    async sendFeatureMail(ctx) {
      const { details, subject } = ctx.request.body;

      // Check if user has exceeded suggestion limit for the day
      const user = ctx.state.user;
      const name = user.username;
      const email = user.email;
      const suggestionLimit = 25; // maximum number of suggestions

      const suggestionCount = user.mail_send_count || 0;

      if (suggestionCount >= suggestionLimit) {
        return ctx.badRequest(
          `You have exceeded the suggestion limit of ${suggestionLimit}. Please contact us at our email contact@actionise.com if you wish this limit to reset.`
        );
      }

      // Send email with user's input details using SendGrid API

      await strapi.plugins["email"].services.email.send({
        to: "contact@actionise.com",
        subject: subject || "New email",
        text: `Name: ${name}\nEmail: ${email}\nDetails: ${details}`,
      });

      // Update user's suggestion count and last suggestion date
      const upload = {
        mail_send_count: suggestionCount + 1,
      };
      await updateUser(user.id, upload);

      // Return success message
      return {
        message: "Feature suggestion or bug report submitted successfully.",
      };
    },

    async me(ctx) {
      const user = ctx.state.user;

      if (!user) {
        return ctx.badRequest(null, [
          { messages: [{ id: "No authorization header was found" }] },
        ]);
      }

      const artifacts_count = await strapi.db
        .query("api::artifact.artifact")
        .count();

      const cards_count = await strapi.db
        .query("api::card.card")
        .count({ is_open: false });

      const levelRewards = await strapi.db
        .query("api::levelreward.levelreward")
        .findMany({
          where: {
            level: {
              $lt: user.level + 1,
            },
          },
        });

      // Reset User
      const today = new Date();
      const isRestarted = formatDate(today) === user.reset_date;
      if (!isRestarted) {
        await strapi
          .service("api::usercard.usercard")
          .resetUser(user, today, formatDate);
      }

      const data = await getUser(user.id, {
        usercards: {
          populate: {
            card: true,
          },
        },
        card_tickets: {
          populate: true,
        },
        action_tickets: {
          populate: true,
        },
        favorite_actions: {
          populate: true,
        },
        favorite_cards: {
          populate: true,
        },
        levelrewards: {
          populate: true,
        },
        artifacts: {
          populate: true,
        },
        avatar: {
          populate: {
            image: true,
          },
        },
        claimed_artifacts: {
          populate: true,
        },
        actions: {
          populate: true,
          populate: {
            image: true,
            steps: true,
            stats: true,
            card: {
              populate: {
                realm: true,
              },
            },
          },
        },

        orders: true,

        shared_by: true,
        shared_buddies: {
          populate: {
            avatar: {
              populate: {
                image: true,
              },
            },
          },
        },
        last_unlocked_cards: true,
        last_completed_cards: true,
        followers: {
          populate: {
            image: true,
          },
        },
        followedBy: true,
      });
      const userDataModified = {
        ...data,
        artifacts_count,
        cards_count,
        levelRewards,
      };
      return userDataModified;
    },

    async getRandomCard(ctx) {
      // 1. get all cards
      function extractCardsIds(usercards) {
        return usercards.map(({ card }) => card.id);
      }

      const user = await getUser(ctx.state.user.id, {
        usercards: {
          populate: {
            card: true,
          },
        },
      });
      console.log({ user: user.usercards });
      const cards = await strapi.db.query("api::card.card").findMany({
        where: {
          $or: [
            {
              is_open: true,
            },
            {
              id: {
                $in: extractCardsIds(user.usercards),
              },
            },
          ],
        },
      });
      // const cardsOwnedByUser =
      console.log({ cards });
      console.log(extractCardsIds(user.usercards));

      function getRandomCard(cardArray) {
        const randomIndex = Math.floor(Math.random() * cardArray.length);
        return cardArray[randomIndex];
      }

      let randomCard = await strapi.db.query("api::card.card").findOne({
        where: { id: getRandomCard(cards).id },
        populate: true,
      });
      randomCard.createdBy = "";
      randomCard.updatedBy = "";
      return randomCard;
      // 2. filter by user has it unlocked.
      // 3. return random card.
    },

    async updateCard(ctx) {
      const user = await getUser(ctx.state.user.id, {
        last_completed_cards: true,
        last_unlocked_cards: true,
        actions: true,
        favorite_actions: true,
        favorite_cards: true,
        artifacts: true,
      });

      const card_id = parseInt(ctx.request.body.id);
      const action = ctx.request.body.action;
      const contentIndex = ctx.request.body.contentIndex || 0;

      if (
        action !== "complete" &&
        action !== "unlock" &&
        action !== "favorite_card" &&
        action !== "complete_action" &&
        action !== "favorite_action" &&
        action !== "complete_contents"
      ) {
        ctx.throw(400, "You can't update the card with unknown intent.");
      }

      let updatedUserCardRelation = await strapi
        .service("api::usercard.usercard")
        .updateCard(user, card_id, action, ctx, contentIndex);

      // OMITTING SENSITIVE DATA TODO: REFETCH QUERY -> NO NEED FOR ANY DATA
      // updatedUserCardRelation["users_permissions_user"] = user.id;
      // updatedUserCardRelation["updated_by"] = user.id;
      // updatedUserCardRelation.users_permissions_user.id;
      return updatedUserCardRelation;
    },

    async updateTutorial(ctx) {
      const user = await getUser(ctx.state.user.id);

      const tutorialStep = ctx.request.body.tutorialStep;

      if (!tutorialStep || tutorialStep < 0 || tutorialStep > 10) {
        return ctx.badRequest("Invalid Tutorial Step");
      }
      const upload = {
        tutorial_step: tutorialStep,
      };

      const data = await updateUser(user.id, upload);
      return data.tutorial_step;
    },

    async collectStreakReward(ctx) {
      const user = await getUser(ctx.state.user.id, {
        shared_buddies: true,
        artifacts: true,
      });

      const streakCount = ctx.request.body.id;

      const streakReward = await strapi.db
        .query("api::streakreward.streakreward")
        .findOne({
          where: { streak_count: streakCount },
          populate: { reward_card: true, artifact: true },
        });

      let userRewards = user.streak_rewards || {};

      if (!streakReward) {
        return ctx.badRequest("This streak reward does not exist.");
      }

      if ((user.highest_streak_count || 0) < streakReward.streak_count) {
        return ctx.badRequest(
          "Your streak is not high enough yet to unlock this reward."
        );
      }

      if (userRewards[streakReward.streak_count]) {
        ctx.throw(400, `You have already claimed this reward.`);
      }

      // SAVE PROGRESS
      userRewards = { ...userRewards, [streakReward.streak_count]: true };

      const upload = {
        streak_rewards: userRewards,
      };

      const data = await updateUser(user.id, upload);
      // GAIN REWARDS SERVICE TRIGGER

      let updatedRewards;

      // GAIN STARS
      if (streakReward.reward_type === "stars") {
        updatedRewards = await strapi
          .service("api::usercard.usercard")
          .gainReward(user, "stars", streakReward.reward_amount);

        return {
          streak_count: data.streak_count,
          updatedRewards,
        };
      }

      // GAIN CARD
      if (streakReward.reward_type === "card") {
        updatedRewards = await strapi
          .service("api::usercard.usercard")
          .gainCard(user, streakReward.reward_card.id);

        return {
          streak_count: data.streak_count,
          updatedRewards,
        };
      }

      // GAIN ARTIFACT
      if (streakReward.reward_type === "artifact") {
        updatedRewards = await strapi
          .service("api::usercard.usercard")
          .gainArtifact(user, streakReward.artifact.id);

        // RETURN MODAL
        return {
          modal: [
            {
              type: "rewards",
              data: { stars: updatedRewards },
            },
            {
              type: "artifact",
              data: streakReward.artifact,
            },
          ],
          streak_count: data.streak_count,
          updatedRewards,
          modal: streakReward.artifact && {
            data: streakReward.artifact,
            type: "artifact",
          },
        };
      }
    },

    async collectFriendsReward(ctx) {
      // static data
      const user = await getUser(ctx.state.user.id, {
        artifacts: true,
      });

      const friendsCount = ctx.request.body.id;

      const friendsReward = await strapi.db
        .query("api::friendreward.friendreward")
        .findOne({
          where: { friends_count: friendsCount },
          populate: { reward_card: true, artifact: true },
        });

      let userRewards = user.friends_rewards || {};

      if (!friendsReward) {
        return ctx.badRequest("This friend reward does not exist.");
      }

      if (user.highest_buddy_shares.length < friendsReward.friends_count) {
        return ctx.badRequest(
          "You don't have enough connected buddies yet to unlock this reward."
        );
      }

      if (userRewards[friendsReward.friends_count]) {
        ctx.throw(400, `You have already claimed this reward.`);
      }

      // SAVE PROGRESS
      userRewards = { ...userRewards, [friendsReward.friends_count]: true };

      const upload = {
        friends_rewards: userRewards,
      };

      const data = await updateUser(user.id, upload);

      let updatedRewards;

      // TODO: ADD HERE WAY TO GAIN PREMIUM DAYS OR ORBS FOR BOTH USERS

      // GAIN CARD
      if (friendsReward.reward_type === "card") {
        updatedRewards = await strapi
          .service("api::usercard.usercard")
          .gainCard(user, friendsReward.reward_card.id);

        return {
          updatedRewards,
        };
      }

      // GAIN REWARDS SERVICE TRIGGER
      if (friendsReward.artifact) {
        updatedRewards = await strapi
          .service("api::usercard.usercard")
          .gainArtifact(user, friendsReward.artifact.id);
      }

      // GAIN REWARDS SERVICE TRIGGER
      // if (!friendsReward.artifact) {
      //   const payload = {
      //     card: friendsReward.reward_card,
      //     quantity: friendsReward.reward_amount,
      //   };

      //   updatedRewards = await strapi
      //     .service("api::usercard.usercard")
      //     .gainCard(user, payload, true);
      // }
      // RETURN MODAL
      return {
        friends_count: data.friends_count,
        updatedRewards,
        modal: friendsReward.artifact && {
          data: friendsReward.artifact,
          type: "artifact",
        },
      };
    },

    async collectLevelReward(ctx) {
      // static data
      const user = await getUser(ctx.state.user.id, {
        artifacts: true,
        levelrewards: true,
      });

      const levelId = ctx.request.body.id;

      const levelReward = await strapi.db
        .query("api::levelreward.levelreward")
        .findOne({
          where: { id: levelId },
          populate: { artifact: true },
        });

      let userRewards = user.rewards_tower || {};

      if (!levelReward) {
        return ctx.badRequest("This level reward does not exist.");
      }

      if (user.level < levelReward.level) {
        return ctx.badRequest(
          "You are not high enough level yet to unlock this reward."
        );
      }

      if (!user.is_subscribed && levelReward.is_premium) {
        return ctx.badRequest(
          "You need premium subscription to unlock this reward."
        );
      }

      if (userRewards[levelReward.id]) {
        ctx.throw(400, `You have already claimed this reward.`);
      }

      // SAVE PROGRESS
      userRewards = { ...userRewards, [levelReward.id]: true };

      const upload = {
        rewards_tower: userRewards,
        levelrewards: [...user.levelrewards, levelReward.id],
      };

      const data = await updateUser(user.id, upload);

      // GAIN ARTIFACT IF THERE IS ONE

      let updatedRewards;

      console.log(levelReward);

      if (levelReward.reward_type === "artifact") {
        updatedRewards = await strapi
          .service("api::usercard.usercard")
          .gainArtifact(user, levelReward.artifact.id);
      }

      // GAIN REWARDS SERVICE TRIGGER
      if (!levelReward.reward_type === "artifact") {
        const rewardType = levelReward.reward_type;
        const quantity = levelReward.reward_amount;

        updatedRewards = await strapi
          .service("api::usercard.usercard")
          .gainReward(user, rewardType, quantity);
      }

      return {
        rewards_tower: data.rewards_tower,
        updatedRewards,
        modal: levelReward.artifact && {
          data: levelReward.artifact,
          type: "artifact",
        },
      };
    },

    async claimArtifact(ctx) {
      const artifactId = ctx.request.body.artifactId;
      const user = await getUser(ctx.state.user.id, {
        artifacts: true,
        claimed_artifacts: true,
      });

      const hasArtifact =
        user.artifacts.filter((a) => parseInt(a.id) == parseInt(artifactId))
          .length > 0;

      if (!hasArtifact) {
        ctx.throw(400, "You dont own this artifact.");
      }

      const alreadyClaimed =
        user.claimed_artifacts.filter(
          (a) => parseInt(a.id) == parseInt(artifactId)
        ).length > 0;

      if (alreadyClaimed) {
        ctx.throw(400, "You have already claimed this artifact.");
      }

      console.log(user.stats);

      let upload = {
        claimed_artifacts: [...user.claimed_artifacts, artifactId],
        stats: {
          ...user.stats,
          claimed_artifacts: user.stats.claimed_artifacts + 1,
        },
      };

      console.log(upload);

      const data = updateUser(user.id, upload, { claimed_artifacts: true });
      return data;
    },

    async claimObjective(ctx) {
      const objectiveId = ctx.request.body.objectiveId;

      const user = await getUser(ctx.state.user.id, { artifacts: true });
      const user_objectives = user.objectives_json || {};

      const objective = await strapi.db
        .query("api::objective.objective")
        .findOne({
          where: { id: objectiveId },
        });

      if (!objective) {
        ctx.throw(400, `This objective does not exist`);
      }
      if (!user_objectives[objective.id] && objective.requirement !== "login") {
        ctx.throw(400, `This objective is not started yet!`);
      }
      if (
        user_objectives[objective.id].progress < objective.requirement_amount &&
        objective.requirement !== "login"
      ) {
        ctx.throw(400, `This objective is not completed yet!`);
      }

      if (objective.is_premium && !user.is_subscribed) {
        ctx.throw(400, `This objective requires a premium subscription`);
      }

      // objectives trigger for daily/weekly
      await strapi
        .service("api::usercard.usercard")
        .objectivesTrigger(
          user,
          objective.time_type === "daily" ? "daily" : "weekly"
        );

      // SAVE PROGRESS
      const updated_user_objectives = {
        ...user_objectives,
        [objective.id]: {
          isCollected: true,
          progress: objective.requirement !== "login" ? 0 : 1,
        },
      };

      let payload = { objectives_json: updated_user_objectives };

      if (
        objective.requirement == "login" &&
        user.streak >= (user.highest_streak_count || 0)
      ) {
        payload = {
          objectives_json: updated_user_objectives,
          highest_streak_count: (user.highest_streak_count || 0) + 1,
        };
      }

      const data = await updateUser(user.id, payload);

      // GAIN REWARDS SERVICE TRIGGER
      const objectiveRewards = await strapi
        .service("api::usercard.usercard")
        .gainObjectiveRewards(user, objective);

      // artifact trigger
      const artifactData = await strapi
        .service("api::usercard.usercard")
        .achievementTrigger(
          user,
          objective.time_type === "daily"
            ? "daily_objectives_complete"
            : "weekly_objectives_complete"
        );

      return {
        user_objectives: data.objectives_json,
        rewards: objectiveRewards,
        artifactTrigger: artifactData,
      };
    },

    async purchaseProduct(ctx) {
      const user = await getUser(ctx.state.user.id, {
        orders: {
          populate: {
            product: true,
          },
        },
      });

      const productId = ctx.request.body.id;

      // const payment_env = ctx.request.body.payment_env;
      const payment_env = "apple";

      const product = await strapi.db.query("api::product.product").findOne({
        where: {
          id: productId,
        },
        populate: { bundle: true },
      });

      if (!product) {
        return ctx.badRequest("Product does not exist.");
      }

      // validation from PAYMENT GATEWAY - DELETE FAKE DATA
      const API = {
        status: "paid",
        amount: product.amount,
        payment_env: payment_env,
      };

      //1. Android Validation
      if (payment_env === "android") {
        //validate purchase status -> API
        // if (okay) => go next, if not return error
      }

      //2. Apple Validation
      if (payment_env === "apple") {
        //validate purchase status -> API
        // if (okay) => go next, if not return error
      }

      //3. CASYS CPAY Validation
      if (payment_env === "cpay") {
        //validate purchase status -> API ???
        // if (okay) => go next, if not return error
      }

      if (
        payment_env !== "android" &&
        payment_env !== "apple" &&
        payment_env !== "cpay"
      ) {
        //error no environment or payment gateway
        return ctx.badRequest("No Payment Method");
      }

      // IF PAYMENT IS SUCCESSFUL -> EXECUTE LOGIC

      // IF PRODUCT === SUBSCRIPTION
      if (product.type === "subscription") {
        if (user.is_subscribed) {
          return ctx.badRequest("You are already subscribed.");
        }

        const upload = {
          is_subscribed: true,
          subscription_date: Date.now(),
        };

        const updatedUser = updateUser(user.id, upload);

        const newOrder = await strapi
          .service("api::usercard.usercard")
          .createOrder(user, product, API);

        const data = {
          newOrder,
          is_subscribed: updatedUser.is_subscribed,
        };

        // SUBSCRIPTION_PURCHASE_SUCCESS
        return data;
      }

      // IF PRODUCT === STARS
      if (product.type === "gems") {
        const newOrder = await strapi
          .service("api::usercard.usercard")
          .createOrder(user, product, API);

        const upload = { gems: user.gems + product.amount };
        await updateUser(user.id, upload);

        const data = {
          newOrder,
          gems: user.gems + product.amount,
        };
        return data;
        // "GEMS_PURCHASE_SUCCESS"
      }

      // IF PRODUCT === BUNDLE
      if (product.type === "bundle") {
        const hasBundle =
          user.orders.filter((order) => order.product.id === product.id)
            .length > 0;

        if (hasBundle) {
          return ctx.badRequest("You have already purchased this bundle.");
        }

        for (let i = 0; i < product.bundle.length; i++) {
          await strapi
            .service("api::usercard.usercard")
            .gainReward(
              user,
              product.bundle[i].type,
              product.bundle[i].quantity
            );
        }

        const newOrder = await strapi
          .service("api::usercard.usercard")
          .createOrder(user, product, API);

        // BUNDLE_PURCHASE_SUCCESS
        return newOrder;
      }
    },

    async followBuddy(ctx) {
      const user = await getUser(ctx.state.user.id, { followers: true });

      const buddyId = parseInt(ctx.request.body.id);

      const buddy = await getUser(buddyId);

      if (!buddy) {
        return ctx.badRequest("Buddy doesn't exist.");
      }

      let upload;
      const userFollowers = user.followers;
      const hasFollower =
        userFollowers.filter((f) => f.id === buddyId).length > 0;

      if (hasFollower) {
        const newFollowers = userFollowers
          .map((f) => f.id)
          .filter((i) => i !== buddyId);
        upload = {
          followers: newFollowers,
        };
      } else {
        upload = { followers: [...user.followers, buddyId] };
      }

      const data = await updateUser(user.id, upload, { followers: true });
      const sanitizedData = data.followers.map((user) => {
        return { id: user.id, username: user.username };
      });
      return sanitizedData;
    },

    async cancelSubscription(ctx) {
      const user = await getUser(ctx.state.user.id);

      const isUnsubscribed = user.is_subscription_cancelled;
      const isPremium = user.is_subscribed;

      if (isUnsubscribed || !isPremium) {
        return ctx.badRequest(
          "Your subscription is cancelled or doesn't exist."
        );
      }

      const upload = { is_subscription_cancelled: true };
      const data = await updateUser(user.id, upload);
      return data.is_unsubscribed;
    },

    async saveAvatar(ctx) {
      const user = await getUser(ctx.state.user.id);
      const avatarId = ctx.request.body.avatarId;

      const avatar = await strapi.db.query("api::avatar.avatar").findOne({
        where: {
          id: avatarId,
        },
      });

      if (!avatar) {
        ctx.throw(400, "Avatar Image does not exist.");
      }

      // check if he can equip avatar ->
      const upload = {
        avatar: avatar.id,
      };
      const data = updateUser(user.id, upload);
      return data;
    },
  })
);
