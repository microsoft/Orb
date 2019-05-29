// -------------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
//
// The MIT License (MIT)
// Copyright (c) 2013 Adam Schwartz
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// This is a fork from https://github.com/adamschwartz/chrome-tabs
// -------------------------------------------------------------------------------

(function () {
    const tabTemplate = `
    <div class="chrome-tab">
      <div class="chrome-tab-background">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg"><defs><symbol id="topleft" viewBox="0 0 214 29" ><path d="M14.3 0.1L214 0.1 214 29 0 29C0 29 12.2 2.6 13.2 1.1 14.3-0.4 14.3 0.1 14.3 0.1Z"/></symbol><symbol id="topright" viewBox="0 0 214 29"><use xlink:href="#topleft"/></symbol><clipPath id="crop"><rect class="mask" width="100%" height="100%" x="0"/></clipPath></defs><svg width="50%" height="100%" transfrom="scale(-1, 1)"><use xlink:href="#topleft" width="214" height="29" class="chrome-tab-background"/><use xlink:href="#topleft" width="214" height="29" class="chrome-tab-shadow"/></svg><g transform="scale(-1, 1)"><svg width="50%" height="100%" x="-100%" y="0"><use xlink:href="#topright" width="214" height="29" class="chrome-tab-background"/><use xlink:href="#topright" width="214" height="29" class="chrome-tab-shadow"/></svg></g></svg>
      </div>
      <div class="chrome-tab-favicon"></div>
      <span class="chrome-tab-title"></span>
      <div class="chrome-tab-close"></div>
    </div>
  `
    const newTabButtonTemplate = `
    <!--<div class="chrome-new-tab">-->
    <div class="chrome-tab chrome-new-tab">
      <div class="chrome-tab-background">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg"><defs><symbol id="topleft" viewBox="0 0 214 29" ><path d="M14.3 0.1L214 0.1 214 29 0 29C0 29 12.2 2.6 13.2 1.1 14.3-0.4 14.3 0.1 14.3 0.1Z"/></symbol><symbol id="topright" viewBox="0 0 214 29"><use xlink:href="#topleft"/></symbol><clipPath id="crop"><rect class="mask" width="100%" height="100%" x="0"/></clipPath></defs><svg width="50%" height="100%" transfrom="scale(-1, 1)"><use xlink:href="#topleft" width="214" height="29" class="chrome-tab-background"/><use xlink:href="#topleft" width="214" height="29" class="chrome-tab-shadow"/></svg><g transform="scale(-1, 1)"><svg width="50%" height="100%" x="-100%" y="0"><use xlink:href="#topright" width="214" height="29" class="chrome-tab-background"/><use xlink:href="#topright" width="214" height="29" class="chrome-tab-shadow"/></svg></g></svg>
      </div>
      <div class="chrome-tab-favicon"></div>
    </div>
  `
    const defaultTapProperties = {
        title: '',
        tooltip: '',
        favicon: '',
        key: ''
    }

    let instanceId = 0

    class ChromeTabs {

        constructor(beforeTabRemove = () => {
            return Promise.resolve(true);
        }, dragable = true, newButton = true) {
            this.draggabillyInstances = []
            this.dragable = dragable
            this.newButton = newButton
            this.beforeTabRemove = beforeTabRemove
        }

        init(el, options) {
            this.el = el
            this.options = options
            this.instanceId = instanceId
            this.el.setAttribute('data-chrome-tabs-instance-id', this.instanceId)
            instanceId += 1

            this.setupStyleEl()
            this.setupEvents()
            this.layoutTabs()
            this.fixZIndexes()
            if (this.dragable) {
                this.setupDraggabilly()
            }
            if (this.newButton) {
                this.setupNewButton();
            }
        }

        emit(eventName, data) {
            this.el.dispatchEvent(new CustomEvent(eventName, { detail: data }))
        }

        setupStyleEl() {
            this.animationStyleEl = document.createElement('style')
            this.el.appendChild(this.animationStyleEl)
        }

        setupEvents() {
            window.addEventListener('resize', event => this.layoutTabs())
            this.el.addEventListener('dblclick', event => this.emit('tabNew'))
            this.el.addEventListener('click', ({ target }) => {
                if (this.newButton && target.classList.contains('chrome-new-tab')) {
                    this.emit('tabNew')
                } else if (target.classList.contains('chrome-tab')) {
                    this.setCurrentTab(target)
                } else if (target.classList.contains('chrome-tab-close')) {
                    this.removeTab(target.parentNode)
                } else if (target.classList.contains('chrome-tab-title') || target.classList.contains('chrome-tab-favicon')) {
                    this.setCurrentTab(target.parentNode)
                }
            })
        }

        getTabByKey(key) {
            let tab;
            this.tabEls.forEach((tabEl) => {
                if (tabEl.getAttribute('key') === key) {
                    tab = tabEl;
                }
            })

            return tab;
        }

        get currentTab() {
            return this.el.querySelector('.chrome-tab-current');
        }

        get tabEls() {
            return Array.prototype.slice.call(this.el.querySelectorAll('.chrome-tab'))
        }

        get tabContentEl() {
            return this.el.querySelector('.chrome-tabs-content')
        }

        get tabWidth() {
            const tabsContentWidth = this.tabContentEl.clientWidth - this.options.tabOverlapDistance
            const width = (tabsContentWidth / this.tabEls.length) + this.options.tabOverlapDistance
            return Math.max(this.options.minWidth, Math.min(this.options.maxWidth, width))
        }

        get tabEffectiveWidth() {
            return this.tabWidth - this.options.tabOverlapDistance
        }

        get tabPositions() {
            const tabEffectiveWidth = this.tabEffectiveWidth;
            let left = 0;
            let positions = [];

            this.tabEls.forEach((tabEl, i) => {
                positions.push(left)
                left += tabEffectiveWidth
            })

            return positions;
        }

        layoutTabs() {
            const tabWidth = this.tabWidth

            if (this.dragable) {
                this.cleanUpPreviouslyDraggedTabs()
            }

            this.tabEls.forEach((tabEl) => tabEl.style.width = tabWidth + 'px')

            if (this.newButton && this.tabEls.length > 0) {
                this.tabEls[this.tabEls.length - 1].style.width = '48px'
            }

            requestAnimationFrame(() => {
                let styleHTML = ''
                this.tabPositions.forEach((left, i) => {
                    styleHTML += `
            .chrome-tabs[data-chrome-tabs-instance-id="${ this.instanceId}"] .chrome-tab:nth-child(${i + 1}) {
              transform: translate3d(${ left}px, 0, 0)
            }
          `
                })
                this.animationStyleEl.innerHTML = styleHTML
            })
        }

        fixZIndexes() {
            const bottomBarEl = this.el.querySelector('.chrome-tabs-bottom-bar')
            const tabEls = this.tabEls

            tabEls.forEach((tabEl, i) => {
                let zIndex = tabEls.length - i

                if (tabEl.classList.contains('chrome-tab-current')) {
                    bottomBarEl.style.zIndex = tabEls.length + 1
                    zIndex = tabEls.length + 2
                }
                tabEl.style.zIndex = zIndex
            })
        }

        createNewTabEl() {
            const div = document.createElement('div')
            div.innerHTML = tabTemplate
            return div.firstElementChild
        }

        addTab(tabProperties, isForegroundTab) {
            const tabEl = this.createNewTabEl()

            tabEl.classList.add('chrome-tab-just-added')
            setTimeout(() => tabEl.classList.remove('chrome-tab-just-added'), 500)

            tabProperties = Object.assign({}, defaultTapProperties, tabProperties)
            if (this.newButton) {
                this.tabContentEl.insertBefore(tabEl, this.tabContentEl.lastChild)
            } else {
                this.tabContentEl.appendChild(tabEl)
            }

            this.updateTab(tabEl, tabProperties)
            this.emit('tabAdd', { tabEl })
            if (isForegroundTab) {
                this.setCurrentTab(tabEl);
            }
            this.layoutTabs()
            this.fixZIndexes()
            if (this.dragable) {
                this.setupDraggabilly()
            }

            tabEl.addEventListener('contextmenu', (ev) => {
                ev.preventDefault();
                this.showContextMenu(tabEl);
            });
        }

        setCurrentTab(tabEl) {
            const currentTab = this.el.querySelector('.chrome-tab-current')
            if (currentTab) currentTab.classList.remove('chrome-tab-current')
            tabEl.classList.add('chrome-tab-current')
            this.fixZIndexes()
            this.emit('activeTabChange', { tabEl })
        }

        removeTab(tabEl) {
            this.beforeTabRemove(tabEl).then((canRemove) => {
                if (canRemove) {
                    if (tabEl.classList.contains('chrome-tab-current')) {
                        if (tabEl.previousElementSibling && tabEl.previousElementSibling !== this.newButton) {
                            this.setCurrentTab(tabEl.previousElementSibling)
                        } else if (tabEl.nextElementSibling && tabEl.nextElementSibling !== this.newButton) {
                            this.setCurrentTab(tabEl.nextElementSibling)
                        }
                    }

                    if (tabEl.parentNode) {
                        tabEl.parentNode.removeChild(tabEl)
                    }

                    this.emit('tabRemove', { tabEl })
                    this.layoutTabs()
                    this.fixZIndexes()
                    if (this.dragable) {
                        this.setupDraggabilly()
                    }
                }
            })
        }

        showContextMenu(tabEl) {
            const electron = require('electron');
            const remote = electron.remote;
            this.contextMenu = remote.Menu.buildFromTemplate([]);
            this.contextMenu.append(
                new remote.MenuItem(
                    {
                        label: 'Close',
                        click: () => {
                            this.removeTab(tabEl);
                        }
                    }
                )
            );

            this.contextMenu.append(
                new remote.MenuItem(
                    {
                        label: 'Close All',
                        click: () => {
                            this.tabEls.forEach((tab) => {
                                if (this.newButton && tab === this.newButton) {
                                    return;
                                }

                                this.removeTab(tab);
                            })
                        }
                    }
                )
            );

            this.contextMenu.append(
                new remote.MenuItem(
                    {
                        label: 'Close to the Right',
                        click: () => {
                            var startRemoving = false;

                            this.tabEls.forEach((tab) => {
                                if (this.newButton && tab === this.newButton) {
                                    return;
                                }

                                if (startRemoving) {
                                    this.removeTab(tab);
                                    return;
                                }

                                if (tab === tabEl) {
                                    startRemoving = true;
                                }
                            })
                        }
                    }
                )
            );

            this.contextMenu.append(
                new remote.MenuItem(
                    {
                        label: 'Close to the Left',
                        click: () => {
                            var startRemoving = true;

                            this.tabEls.forEach((tab) => {
                                if (tab === tabEl) {
                                    startRemoving = false;
                                    return;
                                }

                                if (startRemoving) {
                                    this.removeTab(tab);
                                }
                            })
                        }
                    }
                )
            );

            this.contextMenu.append(
                new remote.MenuItem(
                    {
                        label: 'Close Others',
                        click: () => {
                            this.tabEls.forEach((tab) => {
                                if (this.newButton && tab === this.newButton) {
                                    return;
                                }

                                if (tab !== tabEl) {
                                    this.removeTab(tab);
                                }
                            })
                        }
                    }
                )
            )

            this.contextMenu.popup({});
        }

        updateTab(tabEl, tabProperties) {
            var titleEl = tabEl.querySelector('.chrome-tab-title')
            titleEl.textContent = tabProperties.title
            titleEl.setAttribute('title', tabProperties.tooltip ? tabProperties.tooltip : tabProperties.title)
            tabEl.querySelector('.chrome-tab-favicon').style.backgroundImage = `url('${tabProperties.favicon}')`
            tabEl.setAttribute('key', tabProperties.key)
        }

        updateFavicon(tabEl, tabProperties) {
            if (tabEl) {
                tabEl.querySelector('.chrome-tab-favicon').style.backgroundImage = `url('${tabProperties.favicon}')`
            }
        }

        updateTitle(tabEl, tabProperties) {
            if (tabEl) {
                var titleEl = tabEl.querySelector('.chrome-tab-title')
                titleEl.textContent = tabProperties.title
                titleEl.setAttribute('title', tabProperties.tooltip ? tabProperties.tooltip : tabProperties.title)
            }
        }

        cleanUpPreviouslyDraggedTabs() {
            this.tabEls.forEach((tabEl) => tabEl.classList.remove('chrome-tab-just-dragged'))
        }

        setupDraggabilly() {
            const tabEls = this.tabEls
            const tabEffectiveWidth = this.tabEffectiveWidth
            const tabPositions = this.tabPositions

            this.draggabillyInstances.forEach(draggabillyInstance => draggabillyInstance.destroy())

            tabEls.forEach((tabEl, originalIndex) => {
                const originalTabPositionX = tabPositions[originalIndex]
                const draggabillyInstance = new Draggabilly(tabEl, {
                    axis: 'x',
                    containment: this.tabContentEl
                })

                this.draggabillyInstances.push(draggabillyInstance)

                draggabillyInstance.on('dragStart', () => {
                    this.cleanUpPreviouslyDraggedTabs()
                    tabEl.classList.add('chrome-tab-currently-dragged')
                    this.el.classList.add('chrome-tabs-sorting')
                    this.fixZIndexes()
                    this.removeNewButton()
                })

                draggabillyInstance.on('dragEnd', () => {
                    const finalTranslateX = parseFloat(tabEl.style.left, 10)
                    tabEl.style.transform = `translate3d(0, 0, 0)`

                    // Animate dragged tab back into its place
                    requestAnimationFrame(() => {
                        tabEl.style.left = '0'
                        tabEl.style.transform = `translate3d(${finalTranslateX}px, 0, 0)`

                        requestAnimationFrame(() => {
                            tabEl.classList.remove('chrome-tab-currently-dragged')
                            this.el.classList.remove('chrome-tabs-sorting')

                            this.setCurrentTab(tabEl)
                            tabEl.classList.add('chrome-tab-just-dragged')

                            requestAnimationFrame(() => {
                                tabEl.style.transform = ''

                                this.setupDraggabilly()
                                this.setupNewButton()
                            })
                        })
                    })
                })

                draggabillyInstance.on('dragMove', (event, pointer, moveVector) => {
                    // Current index be computed within the event since it can change during the dragMove
                    const tabEls = this.tabEls
                    const currentIndex = tabEls.indexOf(tabEl)

                    const currentTabPositionX = originalTabPositionX + moveVector.x
                    const destinationIndex = Math.max(0, Math.min(tabEls.length, Math.floor((currentTabPositionX + (tabEffectiveWidth / 2)) / tabEffectiveWidth)))

                    if (currentIndex !== destinationIndex) {
                        this.animateTabMove(tabEl, currentIndex, destinationIndex)
                    }
                })
            })
        }

        animateTabMove(tabEl, originIndex, destinationIndex) {
            if (destinationIndex < originIndex) {
                tabEl.parentNode.insertBefore(tabEl, this.tabEls[destinationIndex])
            } else {
                tabEl.parentNode.insertBefore(tabEl, this.tabEls[destinationIndex + 1])
            }
        }

        moveToNextTab() {
            if (this.currentTab.nextElementSibling && this.currentTab.nextElementSibling !== this.newButton) {
                this.setCurrentTab(this.currentTab.nextElementSibling);
            } else if (this.tabEls.length > 0) {
                this.setCurrentTab(this.tabEls[0]);
            }
        }

        setupNewButton() {
            const div = document.createElement('div')
            div.innerHTML = newTabButtonTemplate
            const tabEl = div.firstElementChild
            tabEl.querySelector('.chrome-tab-favicon').style.backgroundImage = `url('./tab/images/add-favicon.png')`
            this.newButton = tabEl;
            this.tabContentEl.appendChild(tabEl)
            this.layoutTabs()
        }

        removeNewButton() {
            this.tabContentEl.removeChild(this.newButton);
        }
    }

    window.ChromeTabs = ChromeTabs
})()