import { BrowserWindow, Menu } from 'electron'

export interface MenuItemConfig {
  label?: string
  role?: string
  type?: 'normal' | 'separator' | 'checkbox' | 'radio'
  accelerator?: string
  click?: (menuItem: any, browserWindow?: BrowserWindow) => void
  submenu?: MenuItemConfig[]
  checked?: boolean
  id?: string
}

export class MenuBar {
  /**
   * Creates a native menu bar that appears on the system
   * This is used for the native menu bar visible in the title bar area
   */
  static createApplicationMenu(menuTemplate: MenuItemConfig[]): void {
    const template = this.convertToElectronTemplate(menuTemplate)
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  }

  /**
   * Converts our MenuItemConfig format to Electron's MenuItemConstructorOptions
   */
  private static convertToElectronTemplate(config: MenuItemConfig[]): Electron.MenuItemConstructorOptions[] {
    return config.map(item => {
      const electronItem: Electron.MenuItemConstructorOptions = {
        label: item.label,
        role: item.role as any,
        type: item.type as any,
        accelerator: item.accelerator,
        click: item.click,
        submenu: item.submenu ? this.convertToElectronTemplate(item.submenu) : undefined,
        checked: item.checked,
        id: item.id,
      }
      return electronItem
    })
  }

  /**
   * Gets a menu item by ID
   */
  static getMenuItemById(id: string): Electron.MenuItem | null {
    const menu = Menu.getApplicationMenu()
    if (!menu) return null
    return menu.getMenuItemById(id) || null
  }

  /**
   * Updates menu item checked state
   */
  static setMenuItemChecked(id: string, checked: boolean): void {
    const item = this.getMenuItemById(id)
    if (item) {
      item.checked = checked
    }
  }
}
