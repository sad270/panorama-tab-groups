import { loadOptions } from "../../../js/_share/options.js";
import { Group } from "./Group.js";
import { Tab } from "./Tab.js";

export class View {
  constructor() {}

  async initializeView() {
    await Promise.all([
      // key, value, property
      ["options", await loadOptions()],
      ["windowId", await browser.windows.getCurrent(), "id"]
    ]).then(results => {
      for (const result of results) {
        const [key, value, property] = result;

        if (typeof property !== "undefined") {
          this[key] = value[property];
        } else {
          this[key] = value;
        }
      }
    });

    this.lastActiveTab = await this.getLastActiveTab();
    // Update lastActiveTab when changed
    browser.tabs.onActivated.addListener(async activeInfo => {
      const tab = await browser.tabs.get(activeInfo.tabId);
      if (tab.windowId === this.windowId) {
        this.lastActiveTab = await new Tab(tab);
      }
    });
  }

  async getAllTabs() {
    const tabs =
      (await browser.tabs.query({
        windowId: this.windowId
      })) || [];

    return Promise.all(
      tabs.map(async tab => {
        return new Tab(tab);
      })
    );
  }

  async getTabs() {
    const tabs =
      (await browser.tabs.query({
        windowId: this.windowId,
        pinned: false
      })) || [];

    return Promise.all(
      tabs.map(async tab => {
        return new Tab(tab);
      })
    );
  }

  async getPinnedTabs() {
    const tabs =
      (await browser.tabs.query({
        windowId: this.windowId,
        pinned: true
      })) || [];

    return Promise.all(
      tabs.map(async tab => {
        return new Tab(tab);
      })
    );
  }

  async getLastActiveTab() {
    const tabs = await this.getAllTabs();
    let lastActiveTab = null;
    let lastAccessed = 0;

    tabs.forEach(tab => {
      if (tab.lastAccessed > lastAccessed) {
        lastAccessed = tab.lastAccessed;
        lastActiveTab = tab;
      }
    });

    if (lastActiveTab !== null) {
      return await new Tab(lastActiveTab);
    }

    return null;
  }

  async getGroups() {
    const groups =
      (await browser.sessions.getWindowValue(this.windowId, "groups")) || [];

    return Promise.all(
      groups.map(async group => {
        return new Group(this, group);
      })
    );
  }

  async getGroupById(groupId) {
    const groups =
      (await browser.sessions.getWindowValue(this.windowId, "groups")) || [];
    let groupData = {};

    groups.forEach(group => {
      if (group.id === parseInt(groupId)) {
        groupData = group;
      }
    });

    if (groupData.hasOwnProperty("id")) {
      return new Group(this, groupData);
    }
  }

  async createGroup() {
    const groupIndex = await browser.sessions.getWindowValue(
      this.windowId,
      "groupIndex"
    );
    let groups = await this.getGroups();
    const pitchIndex = groups.length - 1;
    let pitchX = 4;
    let pitchY = 2;

    if (groups.length > 8) {
      pitchX = 6;
      pitchY = 3;
    } else if (groups.length > 18) {
      pitchX = 8;
      pitchY = 4;
    }

    // Update group index
    const uid = groupIndex || 0;
    const newGroupUid = uid + 1;
    await browser.sessions.setWindowValue(
      this.windowId,
      "groupIndex",
      newGroupUid
    );

    // Legacy: Add group
    // TODO: Maybe save new Group() in the future?
    const rectX = (1 / pitchX) * (pitchIndex % pitchX);
    const rectW = 1 / pitchX;
    const rectY = (1 / pitchY) * Math.floor(pitchIndex / pitchX);
    const rectH = 1 / pitchY;
    const newGroup = {
      id: newGroupUid,
      name: `${newGroupUid}: ${browser.i18n.getMessage("defaultGroupName")}`,
      containerId: "firefox-default",
      rect: {
        x: rectX,
        y: rectY,
        w: rectW,
        h: rectH,
        i: rectX + rectW,
        y: rectY + rectH
      },
      lastMoved: new Date().getTime()
    };
    groups.push(newGroup);

    await browser.sessions.setWindowValue(this.windowId, "groups", groups);
    await browser.sessions.setWindowValue(
      this.windowId,
      "activeGroup",
      newGroupUid
    );

    newGroup.status = "new";
    return new Group(this, newGroup);
  }

  setTheme(theme) {
    _updateViewSetting("theme", theme);
  }
}

function _updateViewSetting(prefix, value) {
  let classList = document.getElementsByTagName("body")[0].classList;
  for (let classObject of classList) {
    if (classObject.startsWith(`${prefix}-`)) {
      classList.remove(classObject);
    }
  }
  classList.add(`${prefix}-${value}`);
}
