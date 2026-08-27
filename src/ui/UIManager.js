export class UIManager {
  constructor({ root = document.body, actions = {}, sceneController = null } = {}) {
    this.root = root;
    this.actions = new Map(Object.entries(actions));
    this.menus = new Map();
    this.sceneController = sceneController;
  }

  registerAction(name, callback) {
    this.actions.set(name, callback);
  }

  removeAction(name) {
    this.actions.delete(name);
  }

  registerMenu(id, { create, stylesheet = '' } = {}) {
    if (!id || typeof create !== 'function') {
      throw new Error('A menu id and create(root, actions) function are required.');
    }
    this.unregisterMenu(id);
    const container = document.createElement('section');
    container.dataset.menuId = id;
    container.className = 'runtime-menu';
    container.hidden = true;
    container.setAttribute('aria-hidden', 'true');
    create(container, Object.fromEntries(this.actions));
    if (stylesheet) this.injectStylesheet(id, stylesheet);
    this.menus.set(id, container);
    this.root.append(container);
    return container;
  }

  injectStylesheet(id, stylesheet) {
    const style = document.createElement('style');
    style.dataset.menuStyles = id;
    style.textContent = stylesheet;
    document.head.append(style);
  }

  load(menuJSON) {
    if (!menuJSON?.id) throw new Error('Menu requires an id.');
    const container = document.createElement('section');
    container.dataset.menuId = menuJSON.id;
    container.className = 'runtime-menu';
    container.hidden = true;
    container.style.width = `${menuJSON.layout?.width || 400}px`;
    container.style.height = `${menuJSON.layout?.height || 300}px`;

    for (const element of menuJSON.elements || []) {
      if (element.type !== 'button') continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.id = element.id;
      button.textContent = element.label || element.id;
      Object.assign(button.style, element.style || {});
      button.addEventListener('click', () => this.actions.get(element.action)?.(element.params || {}));
      container.append(button);
    }

    this.unregisterMenu(menuJSON.id);
    this.menus.set(menuJSON.id, container);
    this.root.append(container);
    return container;
  }

  unregisterMenu(id) {
    this.menus.get(id)?.remove();
    document.querySelector(`style[data-menu-styles="${CSS.escape(id)}"]`)?.remove();
    this.menus.delete(id);
  }

  hasMenu(id) {
    return this.menus.has(id);
  }

  show(id) {
    const menu = this.menus.get(id);
    if (!menu) throw new Error(`Unknown menu: ${id}`);
    menu.hidden = false;
    menu.setAttribute('aria-hidden', 'false');
    this.sceneController?.pause?.(id);
  }

  hide(id) {
    const menu = this.menus.get(id);
    if (!menu) throw new Error(`Unknown menu: ${id}`);
    menu.hidden = true;
    menu.setAttribute('aria-hidden', 'true');
    this.sceneController?.resume?.(id);
  }

  toggle(id) {
    if (this.isVisible(id)) this.hide(id);
    else this.show(id);
  }

  hideAll() {
    for (const id of this.menus.keys()) this.hide(id);
  }

  isVisible(id) {
    const menu = this.menus.get(id);
    if (!menu) throw new Error(`Unknown menu: ${id}`);
    return !menu.hidden;
  }

  getMenuElement(id) {
    const menu = this.menus.get(id);
    if (!menu) throw new Error(`Unknown menu: ${id}`);
    return menu;
  }
}
