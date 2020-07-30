import * as actions from "./actionTypes";
import Elasticlunr from "../../helpers/elasticlunr";
import { checkOrgHandleExists, checkUserHandleExists } from "./authActions";

const tutorials_index = new Elasticlunr(
  "tutorial_id",
  "owner",
  "tutorial_id",
  "title",
  "summary"
);

export const searchFromTutorialsIndex = query => {
  return tutorials_index.searchFromIndex(query);
};

export const getUserTutorialsBasicData = user_handle => async (
  firestore,
  dispatch
) => {
  try {
    dispatch({ type: actions.GET_USER_TUTORIALS_BASIC_START });
    let index;
    const querySnapshot = await firestore
      .collection("cl_codelabz")
      .doc("user")
      .collection(user_handle)
      .get();

    if (querySnapshot.empty) {
      index = [];
    } else {
      index = querySnapshot.docs.map(doc => {
        const new_doc = {
          owner: user_handle,
          tutorial_id: doc.id,
          title: doc.get("title") || "",
          summary: doc.get("summary") || "",
          featured_image: doc.get("featured_image") || "",
          icon: doc.get("icon") || ""
        };

        tutorials_index.addDocToIndex(new_doc);
        return new_doc;
      });
    }
    dispatch({
      type: actions.GET_USER_TUTORIALS_BASIC_SUCCESS,
      payload: index
    });
  } catch (e) {
    dispatch({
      type: actions.GET_USER_TUTORIALS_BASIC_FAIL,
      payload: e.message
    });
  }
};

export const getOrgTutorialsBasicData = organizations => async (
  firestore,
  dispatch
) => {
  try {
    dispatch({ type: actions.GET_ORG_TUTORIALS_BASIC_START });
    let index = [];

    const getFinalData = async handle => {
      let temp_array;
      const querySnapshot = await firestore
        .collection("cl_codelabz")
        .doc("organization")
        .collection(handle)
        .get();

      if (querySnapshot.empty) {
        temp_array = [];
      } else {
        temp_array = querySnapshot.docs.map(doc => {
          const new_doc = {
            owner: handle,
            tutorial_id: doc.id,
            title: doc.get("title") || "",
            summary: doc.get("summary") || "",
            featured_image: doc.get("featured_image") || "",
            icon: doc.get("icon") || ""
          };
          tutorials_index.addDocToIndex(new_doc);
          return new_doc;
        });
      }

      return temp_array;
    };

    if (organizations.length > 0) {
      const promises = organizations.map(
        async org_handle => await getFinalData(org_handle)
      );

      index = await Promise.all(promises);
    }

    dispatch({
      type: actions.GET_ORG_TUTORIALS_BASIC_SUCCESS,
      payload: index.flat()
    });
  } catch (e) {
    dispatch({
      type: actions.GET_ORG_TUTORIALS_BASIC_FAIL,
      payload: e.message
    });
  }
};

export const clearTutorialsBasicData = () => dispatch =>
  dispatch({ type: actions.CLEAR_TUTORIALS_BASIC_STATE });

export const createTutorial = tutorialData => async (
  firebase,
  firestore,
  dispatch,
  history
) => {
  try {
    dispatch({ type: actions.CREATE_TUTORIAL_START });
    const { title, summary, owner, created_by, is_org } = tutorialData;

    const setData = async type => {
      const document = firestore
        .collection("cl_codelabz")
        .doc(type)
        .collection(owner)
        .doc();

      const documentID = document.id;

      await document.set({
        created_by,
        owner,
        summary,
        title,
        featured_image: "",
        icon: "",
        url: "",
        steps: {
          [`${documentID}_step_1`]: {
            id: `${documentID}_step_1`,
            title: "Step One Title",
            time: 1,
            content: "Sample tutorial step one"
          }
        },
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp()
      });

      await firebase.ref("notes/" + documentID).set({
        [`${documentID}_step_1`]: {
          text: "Sample tutorial step one"
        }
      });
      return documentID;
    };

    if (is_org) {
      const documentID = await setData("organization");
      history.push(`/tutorials/${owner}/${documentID}`);
    } else {
      const documentID = await setData("user");
      history.push(`/tutorials/${owner}/${documentID}`);
    }
    dispatch({ type: actions.CREATE_TUTORIAL_SUCCESS });
  } catch (e) {
    dispatch({ type: actions.CREATE_TUTORIAL_FAIL, payload: e.message });
  }
};

const checkUserOrOrgHandle = handle => async firebase => {
  const userHandleExists = await checkUserHandleExists(handle)(firebase);
  const orgHandleExists = await checkOrgHandleExists(handle)(firebase);

  if (userHandleExists && !orgHandleExists) {
    return "user";
  } else if (!userHandleExists && orgHandleExists) {
    return "organization";
  } else {
    throw Error("Internal server error");
  }
};

export const getCurrentTutorialData = (owner, tutorial_id) => async (
  firebase,
  firestore,
  dispatch
) => {
  try {
    dispatch({ type: actions.GET_CURRENT_TUTORIAL_START });
    const type = await checkUserOrOrgHandle(owner)(firebase);
    const doc = await firestore
      .collection("cl_codelabz")
      .doc(type)
      .collection(owner)
      .doc(tutorial_id)
      .get();

    const steps_obj = doc.get("steps");
    const steps = Object.keys(steps_obj).map(step => steps_obj[step]);
    dispatch({
      type: actions.GET_CURRENT_TUTORIAL_SUCCESS,
      payload: { ...doc.data(), steps, tutorial_id }
    });
  } catch (e) {
    window.location.href = "/";
    dispatch({ type: actions.GET_CURRENT_TUTORIAL_FAIL, payload: e.message });
  }
};