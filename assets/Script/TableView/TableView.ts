import { _decorator, Enum, ScrollView, Prefab, NodePool, error, Widget, instantiate, UITransform, Size, Vec3, Node, Vec2 } from "cc";
import { DEBUG } from "cc/env";
import TableViewCell from "./TableViewCell";

const { ccclass, property, menu } = _decorator;

/**滑动的方式 Horizontal 水平滑动  Vertical 垂直滑动 */
const ScrollModel = Enum({
    Horizontal: 0,
    Vertical: 1,
})

/**对node节点进行扩充，添加自己d定义的属性 */
interface TableCell extends Node {
    /**当前实际的下标 */
    cellIndex: number,
    /**将要转变的下标(用于增删操作) */
    _cellIndex: number
}

@ccclass('TableView')
@menu('TableView')
export default class TableView extends ScrollView {

    @property({ override: true, visible: false, tooltip: "重写父类的属性" })
    horizontal: boolean = false;

    @property({ override: true, visible: false, tooltip: "重写父类的属性" })
    vertical: boolean = true;


    @property(Prefab)
    _cell: Prefab = null;

    @property({ type: Prefab, tooltip: "cell的预制体, 相应的用户自定义脚本必须继承自ViewCell" })
    get cell() {
        return this._cell;
    }
    set cell(value) {
        if (value as Prefab) {
            this._cell = value;
        }
    }

    @property({ type: ScrollModel })
    _ScrollModel = ScrollModel.Vertical;

    @property({ type: ScrollModel, tooltip: '滑动的方向' })
    get ScrollModel() {
        return this._ScrollModel;
    }
    set ScrollModel(value) {
        if (value == ScrollModel.Horizontal) {
            this.horizontal = true;
            this.vertical = false;
        } else if (value == ScrollModel.Vertical) {
            this.horizontal = false;
            this.vertical = true;
        }
        this._ScrollModel = value;
    }

    //====================================================本地存储的数据
    /**当前cell的具体数据 */
    private _cellData: any = null;
    /**当前cell的宽/高 */
    private _cellSize: number = null;
    /**当前cell的数量 */
    private _cellCount: number = null;
    /**当前总cell的数量 */
    private _allCellCount: number = null;
    /**cell节点的对象池 */
    private _cellPool: NodePool = new NodePool();

    /**最大的开始下标 */
    private _maxStartIndex: number = null;
    /**开始的下标 */
    private _startIndex: number = null;
    /**结束的下标 */
    private _endIndex: number = null;

    /**距离content的top的距离 */
    private _contentTopY: number = null;
    /**距离content的left的距离 */
    private _contentLeftX: number = null;

    /**是否刷新当前的cell */
    private _updateCellsOn: boolean = false;
    /**刷新一次cell */
    private _updateCellsOnce: boolean = false;

    /**一页内容的所占整体的百分比 */
    private _pagePercent: number;
    public get pagePercent(): number{
        return this._pagePercent;
    }
    //====================================================生命周期函数

    onLoad() {
        
    }

    start() {

    }

    onEnable() {
        this.node.on(ScrollView.EventType.SCROLL_BEGAN, this.onEventScrollBegin, this);
        this.node.on(ScrollView.EventType.SCROLL_ENDED, this.onEventScrollEnd, this);

        super.onEnable();
    }

    onDisable() {
        this.node.off(ScrollView.EventType.SCROLL_BEGAN, this.onEventScrollBegin, this);
        this.node.off(ScrollView.EventType.SCROLL_ENDED, this.onEventScrollEnd, this);

        super.onDisable();
    }


    update(dt) {
        super.update(dt);
        if (this._updateCellsOn || this._updateCellsOnce) {
            this._updateCells();
        }
    }

    //====================================================onEvent
    /**
     * 移动开始响应事件
     */
    private onEventScrollBegin() {
        this._updateCellsOn = true;
    }

    /**
     * 移动结束响应事件
     */
    private onEventScrollEnd() {
        this._updateCellsOn = false;
    }

    //=========================================================================共有方法

    /**
     * 初始化tableView
     * @param data 
     */
    public init<T>(data: Array<T>): void {
        if(this._cellData != null){
            this.refresh(data);
        }else{
            this._cellData = data;
            this._allCellCount = data.length;
            this._init();
        }
    }

    /**
     * 刷新tableView
     * @param data 
     */
    public refresh<T>(data: Array<T>): void {
        this._cellData = data;
        this._allCellCount = data.length;
        this._cellCount = this._getCellCount_X();
        this.stopAutoScroll(); // 如果不加上这句，就会在移动的时候自己滑动
        this._setContentSize_X();
        this._setMaxStartIndex_X();
        this._updateCells(true);
    }

    /**
     * 清空tableView
     */
    public clear() {
        this._cellData = null;
        this._allCellCount = 0;
        this._cellCount = 0;
        this._startIndex = 0;
        this._maxStartIndex = 0;
        this._endIndex = 0;
        this._contentLeftX = 0;
        this._contentTopY = 0;
        this._setContentSize_X();
        this._setContentPosition_X();//ScrollView里面有一个_setContentPosition这个方法，加上 _X 防止覆盖方法
        this._setMaxStartIndex_X();
        this._updateCellsCount_X();
    }

    //========================================================================= 私有方法

    /**
     * 初始化
     */
    private _init() {
        //确保各种组件已挂载
        if (DEBUG) {
            if (!this.content) {
                return error("【tableView】请指定content")
            }
            if (!this._cell) {
                return error("【tableView】请指定cell")
            }
            if (!<TableViewCell>this._cell.data.getComponent(TableViewCell)) {
                return error("【tableView】请在cell中添加继承自<TableViewCell>的自定义组件")
            }
        }
        this._cellSize = this._getCellSize();
        this._cellCount = this._getCellCount_X();
        this._setContentSize_X();
        this._setContentPosition_X();
        this._setMaxStartIndex_X();
        this._updateCells();
    }

    /**
     * 获取当前cell的宽度/高度
     * @returns 
     */
    private _getCellSize() {
        let size: number = null;
        //cell上不能挂载widget组件
        if (this._cell.data.getComponent(Widget)) {
            console.error("【tableView】cell上不可挂载widget组件")
            return size;
        }

        if (this._cell) {
            if (this._ScrollModel == ScrollModel.Horizontal) {
                size = this._cell.data.getComponent(UITransform).contentSize.width;
            } else if (this._ScrollModel == ScrollModel.Vertical) {
                size = this._cell.data.getComponent(UITransform).contentSize.height;
            } else {
                size = 0;
            }
        } else {
            size = 0;
        }
        return size;
    }

    /**
     * 获取当前view中展示的cell的数量
     * @returns 
     */
    private _getCellCount_X() {
        let cellCount: number = null;
        let viewSize: number = null;
        if (this._ScrollModel == ScrollModel.Horizontal) {
            viewSize = this.content.parent.getComponent(UITransform).contentSize.width;
        } else {
            viewSize = this.content.parent.getComponent(UITransform).contentSize.height;
        }
        cellCount = Math.ceil(viewSize / this._cellSize) + 1;
        if (cellCount > this._allCellCount) {
            cellCount = this._allCellCount;
        }
        return cellCount;
    }

    /**
     * 设置content的高度/宽度
     */
    private _setContentSize_X() {
        let contentSize = this._cellSize * this._allCellCount;
        let trans: UITransform = this.content.getComponent(UITransform);
        let tbTrans = this.node.getComponent(UITransform);

        if (this._ScrollModel == ScrollModel.Horizontal) {
            trans.setContentSize(new Size(contentSize, trans.contentSize.height));
            this._contentLeftX = -contentSize / 2;

            this._pagePercent = tbTrans.width/(contentSize - tbTrans.width);
        } else {
            trans.setContentSize(new Size(trans.contentSize.width, contentSize));
            this._contentTopY = contentSize / 2;

            this._pagePercent = tbTrans.height/(contentSize - tbTrans.width);
        }
        if(this._pagePercent > 1){
            this._pagePercent = 1;
        }
    }

    /**
     * 设置content的位置
     */
    private _setContentPosition_X() {
        //强行将锚点设置到（0.5, 0.5）
        let trans = this.content.getComponent(UITransform);
        trans.setAnchorPoint(new Vec2(0.5, 0.5));
        // this.content.position = new Vec3(0, 0, 0);

        let pos: number = null;
        let size: Size = this.content.getComponent(UITransform).contentSize;
        let parent_size: Size = this.content.parent.getComponent(UITransform).contentSize;
        let pos2 = this.content.position;
        if (this._ScrollModel == ScrollModel.Horizontal) {
            pos = parent_size.width / 2 - size.width / 2;
            this.content.position = new Vec3(-pos, pos2.y, pos2.z);//锚点在0.5， 0.5
            // this.content.position = new Vec3(0, pos2.y, pos2.z);
        } else {
            pos = parent_size.height / 2 - size.height / 2;
            this.content.position = new Vec3(pos2.x, pos, pos2.z);//锚点在0.5， 0.5
            // this.content.position = new Vec3(pos2.x, 0, pos2.z);
        }
    }

    /**
     * 设置开始的最大下标
     */
    private _setMaxStartIndex_X() {
        if (this._allCellCount > this._cellCount) {
            this._maxStartIndex = this._allCellCount - this._cellCount;
        } else {
            this._maxStartIndex = 0;
        }
    }


    /**
     * 获取cell预制体
     * @returns 
     */
    private _getCell(): TableCell {
        let tempNode: TableCell = null;
        if (this._cellPool.size()) {
            tempNode = this._cellPool.get() as unknown as TableCell;
        } else {
            tempNode = instantiate(this._cell) as unknown as TableCell;
        }
        tempNode.cellIndex = -1;
        tempNode._cellIndex = -1;
        return tempNode;
    }

    /**
     * 将预制体放入对象池中
     */
    private _putCell(cell: Node): void {
        this._cellPool.put(cell);
    }

    /**
     * 更新cell的具体数量
     */
    private _updateCellsCount_X() {
        let nowCount: number = this.content.children.length;
        const children: TableCell[] = <TableCell[]>this.content.children;
        if (nowCount == this._cellCount) {
            return;
        } else if (nowCount < this._cellCount) {
            for (let i = nowCount; i < this._cellCount; i++) {
                this.content.addChild(this._getCell());
            }
        } else {
            for (let index = nowCount - 1; index >= this._cellCount; index--) {
                let cell = children[index]
                if (cell._cellIndex < this._startIndex || cell._cellIndex > this._endIndex) {
                    this._unInitCell(cell);
                    this._putCell(cell);
                }
            }

            for (let index = nowCount - 1; index >= this._cellCount; index--) {
                let cell = children[index];
                if(cell){
                    this._unInitCell(cell);
                    this._putCell(cell);
                }
            }
        }
    }

    /**
     * 更新cell显示的具体下标，根据content的具体位置来计算对应的展示cell
     */
    private _updateCellRange() {
        const scrollLen = this.getScrollOffset(); //获取滚动视图相对于左上角原点的当前滚动偏移
        let offset: number = null;
        if (this.ScrollModel == ScrollModel.Horizontal) {
            offset = -scrollLen.x;
        } else {
            offset = scrollLen.y;
        }

        if (offset < 0) {
            offset = 0;
        }
        let startIndex = Math.floor(offset / this._cellSize); //开始的index
        if (startIndex < 0) {
            startIndex = 0;
        } else if (startIndex > this._maxStartIndex) {
            startIndex = this._maxStartIndex;
        }

        this._startIndex = startIndex;
        this._endIndex = this._startIndex + this._cellCount - 1;
    }

    private _initCell(cell: TableCell, index: number, force?: boolean) {
        if (index >= 0) {
            if(cell.cellIndex != index || cell.cellIndex != cell._cellIndex || force){
                const com = cell.getComponent(TableViewCell);
                if(cell.cellIndex>0){
                    com.unInit();
                }
                com.init(index, this._cellData[index], this);
            }
            cell._cellIndex = index;
            cell.cellIndex = index;
        }
    }

    private _unInitCell(cell: TableCell) {
        if (cell.cellIndex >= 0) {
            cell.cellIndex = -1;
            cell._cellIndex = -1;
        }
    }

    /**
     * 刷新单个cell的显示
     */
    private _updateCell(cell: TableCell, index?: number, force?: boolean) {
        //刷新cellIndex和_cellIndex
        if (typeof index === "number") {
            this._initCell(cell, index, force);
        }else{
            this._initCell(cell,cell._cellIndex, force);
            index = cell.cellIndex;
        }

        if (this._ScrollModel == ScrollModel.Horizontal) {
            let tempX = this._contentLeftX - this._cellSize / 2 + this._cellSize * (index + 1);
            // cell.position = new Vec3(tempX, cell.position.y, cell.position.z);
            cell.position = new Vec3(tempX, 0, cell.position.z);
        } else {
            let tempY = this._contentTopY + this._cellSize / 2 - this._cellSize * (index + 1);
            // cell.position = new Vec3(cell.position.x, tempY, cell.position.z);
            cell.position = new Vec3(0, tempY, cell.position.z);
        }
    }

    /**
     * 刷新cell的具体显示
     * @param force 是否强制刷新展示的cell
     */
    private _updateCells(force?: boolean) {
        this._updateCellsOnce = false;

        this._updateCellRange();
        this._updateCellsCount_X();

        if (!this._cellCount) return;
        const startIndex = this._startIndex; //开始的index
        const endIndex = this._endIndex; //结束的index
        const children: TableCell[] = <TableCell[]>this.content.children; //content的所有子节点
        //无需计算
        if (children[0]._cellIndex == startIndex && children[children.length - 1].cellIndex == endIndex && !force) {
            return;
        }else{
            children.forEach((cell, index) => {
                // console.log("wanba 当前的cell的具体数据", cell._cellIndex, cell.cellIndex);
                this._updateCell(cell, startIndex + index, force);
            })
            return;
        }

        const keepCell: TableCell[] = [];   //不需要刷新的cell
        const changeCell: TableCell[] = [];     //需要刷新的cell

        children.forEach(cell => {
            if (cell._cellIndex < startIndex || cell._cellIndex > endIndex || cell._cellIndex != cell.cellIndex) {
                this._unInitCell(cell);
                changeCell.push(cell);
            } else {    
                keepCell.push(cell);
            }
        })

        if (changeCell.length == 0) {
            //无需进行刷新
        } else if (keepCell.length == 0) {
            children.forEach((cell, index) => {
                this._updateCell(cell, startIndex + index);
                //cell.getComponent(TableViewCell).init(startIndex + index, this._cellData[startIndex + index]);
            })
        } else {
            for (let index = startIndex, keepPoint = 0, changePoint = 0, i = 0; index <= endIndex; index++ , i++) {
                if (keepPoint < keepCell.length && index == keepCell[keepPoint]._cellIndex) {
                    this._updateCell(keepCell[keepPoint++]);
                } else {
                    this._updateCell(changeCell[changePoint++], index);
                }
            }
        }


        children.forEach(cell => {
            cell.setSiblingIndex(cell.cellIndex - startIndex);
        })

        // this.content.sortAllChildren();
    }

    /**
     * 根据数据下标返回item容器
     * @param index 
     * @
     */
    public getCellByIndex(index: number): Node{
        const children: TableCell[] = <TableCell[]>this.content.children; //content的所有子节点
        let targe:Node = null;
        children.forEach((cell) => {
            if(cell.cellIndex == index){
                targe = cell;
            }
        })
        return targe;
    }

    /**
     * 移动到目标数据的位置
     * @param index 指定数据在数据数组中的下标
     * @param timeInSecond 移动时间
     * @param attenuated 滚动加速是否衰减，默认为 true。
     */
    scrollToTargetIndex(index: number, timeInSecond?: number, attenuated?: boolean){
        if(this._cellData == null){
            return;
        }
        let totalLen = this._cellData.length;
        let percent = 1;
        let targetSize = 0;
        let trans = this.content.parent.getComponent(UITransform);

        if (this._ScrollModel == ScrollModel.Horizontal) {
            targetSize = trans.width;
        } else if (this._ScrollModel == ScrollModel.Vertical) {
            targetSize = trans.height;
        }
        
        let viewIndex = targetSize/this._cellSize;
        let halfViewIndex = viewIndex/2;
        let uIndex = index - halfViewIndex + 0.5;
        let bIndex = totalLen - uIndex - viewIndex;

        if (this._ScrollModel == ScrollModel.Horizontal) {
            //传入的百分比是  =  左边不可见区域的长度/(content长度-view长度)
            percent = uIndex/(totalLen - viewIndex);
        } else if (this._ScrollModel == ScrollModel.Vertical) {
            //传入的百分比是  =  底部不可见区域的长度/(content长度-view长度)
            percent = bIndex/(totalLen - viewIndex);
        }
        
        percent = percent < 0 ? 0 : percent;
        percent = percent > 1 ? 1 : percent;

        console.log("percent = ", percent);
        
        if (this._ScrollModel == ScrollModel.Horizontal) {
            this.scrollToPercentHorizontal(percent, timeInSecond, attenuated);
        } else if (this._ScrollModel == ScrollModel.Vertical) {
            this.scrollToPercentVertical(percent, timeInSecond, attenuated);
        }
    }

    /**
     * 向后翻页
     * @param timeInSecond 移动时间
     * @param attenuated 滚动加速是否衰减，默认为 true。
     * @returns 
     */
    scrollToNextPage(timeInSecond?: number, attenuated?: boolean){
        if(this._cellData == null){
            return;
        }
        const scrollLen = this.getScrollOffset(); //获取滚动视图相对于左上角原点的当前滚动偏移
        let tbTrans = this.node.getComponent(UITransform);
        let trans = this.content.getComponent(UITransform);
        let percent = 1;
        if (this._ScrollModel == ScrollModel.Horizontal) {
            if(trans.width <= tbTrans.width){
                return;
            }
            //传入的百分比是  =  左边不可见区域的长度/(content长度-view长度)
            percent = (Math.abs(scrollLen.x))/(trans.width - tbTrans.width) + this._pagePercent;
        } else if (this._ScrollModel == ScrollModel.Vertical) {
            if(trans.height <= tbTrans.height){
                return;
            }
            //传入的百分比是  =  底部不可见区域的长度/(content长度-view长度)
            percent = (trans.height - tbTrans.height - Math.abs(scrollLen.y))/(trans.height - tbTrans.height) + this._pagePercent;
        }

        percent = percent < 0 ? 0 : percent;
        percent = percent > 1 ? 1 : percent;

        console.log("percent = ", percent);
        
        if (this._ScrollModel == ScrollModel.Horizontal) {
            this.scrollToPercentHorizontal(percent, timeInSecond, attenuated);
        } else if (this._ScrollModel == ScrollModel.Vertical) {
            this.scrollToPercentVertical(percent, timeInSecond, attenuated);
        }
    }

    /**
     * 向前翻页
     * @param timeInSecond 移动时间
     * @param attenuated 滚动加速是否衰减，默认为 true。
     * @returns 
     */
    scrollToLastPage(timeInSecond?: number, attenuated?: boolean){
        if(this._cellData == null){
            return;
        }
        const scrollLen = this.getScrollOffset(); //获取滚动视图相对于左上角原点的当前滚动偏移
        let tbTrans = this.node.getComponent(UITransform);
        let trans = this.content.getComponent(UITransform);
        let percent = 1;
        if (this._ScrollModel == ScrollModel.Horizontal) {
            if(trans.width <= tbTrans.width){
                return;
            }
            //传入的百分比是  =  左边不可见区域的长度/(content长度-view长度)
            percent = (Math.abs(scrollLen.x))/(trans.width - tbTrans.width) - this._pagePercent;
        } else if (this._ScrollModel == ScrollModel.Vertical) {
            if(trans.height <= tbTrans.height){
                return;
            }
             //传入的百分比是  =  底部不可见区域的长度/(content长度-view长度)
             percent = (trans.height - tbTrans.height - Math.abs(scrollLen.y))/(trans.height - tbTrans.height) - this._pagePercent;
        }

        percent = percent < 0 ? 0 : percent;
        percent = percent > 1 ? 1 : percent;

        console.log("percent = ", percent);
        
        if (this._ScrollModel == ScrollModel.Horizontal) {
            this.scrollToPercentHorizontal(percent, timeInSecond, attenuated);
        } else if (this._ScrollModel == ScrollModel.Vertical) {
            this.scrollToPercentVertical(percent, timeInSecond, attenuated);
        }
    }

    //===========================================================================================对scrollView方法的重写

    scrollToLeft(timeInSecond?: number, attenuated?: boolean) {
        this.stopAutoScroll();
        if (timeInSecond) {
            this._updateCellsOn = true;
        } else {
            this._updateCellsOnce = true;
        }
        super.scrollToLeft(timeInSecond, attenuated);
    }

    scrollToRight(timeInSecond?: number, attenuated?: boolean) {
        this.stopAutoScroll();
        if (timeInSecond) {
            this._updateCellsOn = true;
        } else {
            this._updateCellsOnce = true;
        }
        super.scrollToRight(timeInSecond, attenuated);
    }

    scrollToTop(timeInSecond?: number, attenuated?: boolean) {
        this.stopAutoScroll();
        if (timeInSecond) {
            this._updateCellsOn = true;
        } else {
            this._updateCellsOnce = true;
        }
        super.scrollToTop(timeInSecond, attenuated);
    }

    scrollToBottom(timeInSecond?: number, attenuated?: boolean) {
        this.stopAutoScroll();
        if (timeInSecond) {
            this._updateCellsOn = true;
        } else {
            this._updateCellsOnce = true;
        }
        super.scrollToBottom(timeInSecond, attenuated);
    }

    scrollToPercentVertical(percent: number, timeInSecond?: number, attenuated?: boolean){
        this.stopAutoScroll();
        if (timeInSecond) {
            this._updateCellsOn = true;
        } else {
            this._updateCellsOnce = true;
        }
        super.scrollToPercentVertical(percent, timeInSecond, attenuated);
    }

    scrollToPercentHorizontal(percent: number, timeInSecond?: number, attenuated?: boolean){
        this.stopAutoScroll();
        if (timeInSecond) {
            this._updateCellsOn = true;
        } else {
            this._updateCellsOnce = true;
        }
        super.scrollToPercentHorizontal(percent, timeInSecond, attenuated);
    }
}

