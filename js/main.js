// 全局变量
let graph;
let simulation;
let svg, container;
let width, height;
let tooltip;
let selectedNode = null;

// 颜色映射 - 使用更专业的配色方案，确保主次关系清晰
const groupColors = {
    '主角': '#E63946',          // 鲜明的红色，突出主角地位
    '金陵十二钗正册': '#9D4EDD', // 紫色，表示高贵身份
    '金陵十二钗副册': '#C77DFF', // 浅紫色，与正册形成层次关系
    '贾府': '#457B9D',          // 蓝色，表示贾府的稳重
    '林府': '#1D3557',          // 深蓝色，表示林府的深沉
    '薛府': '#F1C453',          // 金黄色，表示薛府的富贵
    '次要角色': '#A8DADC'        // 浅蓝绿色，不抢眼但有辨识度
};

const relationColors = {
    '亲属': '#f7b55c', // 温暖的橙色，代表家庭关系的温馨，婚姻关系，亲子关系
    '婚姻': '#de2f44', // 粉红色，代表浪漫关系
    '社交': '#1154b2', // 蓝色，代表社交关系的理性
    '主仆': '#98d606',  // 绿色，代表服务关系
    '特殊': '#d900ff'   // 紫色，代表特殊关系
};

// 初始化函数
function init() {
    // 获取容器尺寸
    const graphContainer = document.getElementById('graph-container');
    width = graphContainer.clientWidth;
    height = graphContainer.clientHeight;

    // 初始化SVG
    svg = d3.select('#graph')
        .attr('width', width)
        .attr('height', height);

    // 创建缩放容器
    container = svg.append('g');

    // 添加缩放行为
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
            container.attr('transform', event.transform);
        });

    svg.call(zoom);

    // 创建提示框
    tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);

    // 加载数据
    loadData();

    // 添加事件监听器
    addEventListeners();
}

// 加载数据
async function loadData() {
    try {
        // 直接加载hongloumeng.json文件
        const response = await fetch('data/hongloumeng.json');
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }
        const data = await response.json(); // 直接使用内置JSON解析
        if (!data || !data.nodes || !data.links) {
            throw new Error('JSON数据格式不正确，缺少nodes或links属性');
        }
        graph = data;
        renderGraph(graph);
        createGroupLegend(); // 创建分组图例
    } catch (error) {
        console.error('加载数据失败:', error);
        // 显示错误信息在页面上
        container.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('text-anchor', 'middle')
            .text('数据加载失败: ' + error.message);
    }
}

// 渲染关系图
function renderGraph(data) {
    // 清空容器
    container.selectAll('*').remove();

    // 预处理链接数据，确保source和target是对象引用而不是字符串
    const nodeById = {};
    data.nodes.forEach(node => {
        nodeById[node.id] = node;
    });

    // 处理链接，确保source和target是对象引用
    data.links.forEach(link => {
        if (typeof link.source === 'string') {
            link.source = nodeById[link.source];
        }
        if (typeof link.target === 'string') {
            link.target = nodeById[link.target];
        }
    });

    // 创建力导向模拟
    simulation = d3.forceSimulation(data.nodes)
        .force('link', d3.forceLink(data.links).id(d => d.id).distance(100)) // 减小连接距离
        .force('charge', d3.forceManyBody().strength(-200)) // 减小节点间斥力
        .force('center', d3.forceCenter(width / 2, height / 2).strength(0.01)) // 增加中心引力
        .force('collide', d3.forceCollide().radius(20)) // 减小碰撞半径
        .force('x', d3.forceX(width / 2).strength(0.1)) // 添加X方向引力
        .force('y', d3.forceY(height / 2).strength(0.1)); // 添加Y方向引力

    // 绘制连线
    const link = container.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(data.links)
        .enter().append('line')
        .attr('class', d => `link ${d.type}-link`)
        .attr('stroke-width', d => Math.sqrt(d.value))
        .attr('stroke', d => relationColors[d.type] || '#999')
        .on('mouseover', handleLinkMouseOver)
        .on('mouseout', handleLinkMouseOut);

    // 创建节点组
    const node = container.append('g')
        .attr('class', 'nodes')
        .selectAll('.node')
        .data(data.nodes)
        .enter().append('g')
        .attr('class', 'node')
        .call(d3.drag()
            .on('start', dragStarted)
            .on('drag', dragged)
            .on('end', dragEnded))
        .on('click', handleNodeClick)
        .on('mouseover', handleNodeMouseOver)
        .on('mouseout', handleNodeMouseOut);

    // 添加节点圆圈
    node.append('circle')
        .attr('r', d => {
            // 主要人物使用较大半径，次要人物使用较小半径
            return d.group === '次要角色' ? 7 : 10;
        })
        .attr('fill', d => {
            // 如果节点分组在我们定义的颜色映射中，则使用对应颜色
            if (groupColors[d.group]) {
                return groupColors[d.group];
            }
            // 对于原来的'其他'分组或未定义分组，使用'次要角色'的颜色
            return groupColors['次要角色'];
        })
        .attr('stroke', '#fff')
        .attr('stroke-width', d => d.group === '次要角色' ? 1 : 2);

    // 添加节点文本
    node.append('text')
        .attr('dy', d => d.group === '次要角色' ? 15 : 20) // 次要人物文本更靠近节点
        .attr('text-anchor', 'middle')
        .text(d => d.id)
        .attr('font-size', d => d.group === '次要角色' ? '8px' : '10px'); // 次要人物文本更小

    // 更新模拟
    simulation.on('tick', () => {
        // 边界检测，防止节点移出可视区域
        data.nodes.forEach(d => {
            // 为次要人物节点添加额外的中心引力
            if (d.group === '次要角色') {
                // 计算到中心的距离
                const dx = d.x - width / 2;
                const dy = d.y - height / 2;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 如果距离中心太远，施加额外引力
                if (distance > Math.min(width, height) / 3) {
                    d.x -= dx * 0.03;
                    d.y -= dy * 0.03;
                }
            }
            
            // 边界约束，确保节点在容器内
            const r = 15; // 节点半径加一些边距
            d.x = Math.max(r, Math.min(width - r, d.x));
            d.y = Math.max(r, Math.min(height - r, d.y));
        });
        
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node
            .attr('transform', d => `translate(${d.x},${d.y})`);
    });

}

// 节点拖拽函数
function dragStarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragEnded(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}

// 节点点击处理
function handleNodeClick(event, d) {
    event.stopPropagation();
    selectedNode = d;
    showInfoPanel(d);
    highlightConnections(d);
}

// 显示信息面板
function showInfoPanel(node) {
    const infoPanel = document.getElementById('info-panel');
    const characterName = infoPanel.querySelector('.character-name');
    const characterImage = infoPanel.querySelector('.character-image');
    const characterDescription = infoPanel.querySelector('.character-description');
    const characterRelations = infoPanel.querySelector('.character-relations');

    // 设置信息
    characterName.textContent = node.id;
    
    // 设置图片（如果有）
    if (node.image) {
        // 尝试使用JSON中的图片名称
        let imgPath = `images/${node.image}`;
        
        // 如果JSON中的图片名称是英文名+Img.jpg格式，尝试转换为中文名
        if (node.image.includes('Img.jpg')) {
            // 从id获取中文名
            const chineseName = node.id;
            if (chineseName) {
                imgPath = `images/${chineseName}.jpg`;
            }
        }
        
        characterImage.style.backgroundImage = `url('${imgPath}')`; 
        characterImage.textContent = '';
    } else {
        characterImage.style.backgroundImage = 'none';
        characterImage.textContent = '暂无图片';
    }

    // 设置描述
    characterDescription.textContent = node.description || '暂无描述';

    // 设置关系列表
    characterRelations.innerHTML = '';
    const relations = graph.links.filter(link => 
        link.source.id === node.id || link.target.id === node.id
    );

    relations.sort((a, b) => b.value - a.value);
    
    relations.slice(0, 10).forEach(relation => {
        const li = document.createElement('li');
        const relatedPerson = relation.source.id === node.id ? relation.target.id : relation.source.id;
        li.innerHTML = `<strong>${relatedPerson}</strong>: ${relation.description || relation.type}`;
        characterRelations.appendChild(li);
    });

    // 显示面板
    infoPanel.style.display = 'block';
}

// 高亮相关连接
function highlightConnections(node) {
    // 重置所有节点和连线的样式
    container.selectAll('.node circle')
        .attr('r', d => d.group === '次要角色' ? 7 : 10)
        .attr('stroke-width', d => d.group === '次要角色' ? 1 : 2);
    container.selectAll('.link').attr('stroke-opacity', 0.6);

    // 高亮选中的节点
    container.selectAll('.node')
        .filter(d => d.id === node.id)
        .select('circle')
        .attr('r', d => d.group === '次要角色' ? 12 : 15)
        .attr('stroke-width', 3);

    // 高亮相关连接和节点
    const connectedLinks = graph.links.filter(link => 
        link.source.id === node.id || link.target.id === node.id
    );

    // 设置连线样式：相关连线高亮，其他连线灰显
    container.selectAll('.link')
        .attr('stroke-opacity', d => {
            return connectedLinks.includes(d) ? 1 : 0.1;
        })
        .style('filter', d => {
            return connectedLinks.includes(d) ? 'none' : 'saturate(0%)';
        });

    // 获取与选中节点直接相连的节点ID集合
    const connectedNodes = new Set();
    connectedLinks.forEach(link => {
        connectedNodes.add(link.source.id === node.id ? link.target.id : link.source.id);
    });

    // 设置节点样式：选中节点和相关节点保持原色，其他节点灰显
    container.selectAll('.node')
        .select('circle')
        .attr('stroke-opacity', d => {
            return d.id === node.id || connectedNodes.has(d.id) ? 1 : 0.15;
        })
        .attr('fill-opacity', d => {
            return d.id === node.id || connectedNodes.has(d.id) ? 1 : 0.15;
        });
        
    // 为无关节点添加灰色滤镜效果
    container.selectAll('.node')
        .select('circle')
        .style('filter', d => {
            return d.id === node.id || connectedNodes.has(d.id) ? 'none' : 'saturate(30%)';
        });
        
    // 设置文本样式：相关节点文本保持原样，其他节点文本灰显
    container.selectAll('.node text')
        .attr('opacity', d => {
            return d.id === node.id || connectedNodes.has(d.id) ? 1 : 0.3;
        });
}

// 节点悬停处理
function handleNodeMouseOver(event, d) {
    if (selectedNode) return; // 如果已有选中节点，不显示提示

    tooltip.transition()
        .duration(200)
        .style('opacity', .9);
    tooltip.html(`<strong>${d.id}</strong><br/>${d.group}<br/>${d.family || ''}`)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');
}

function handleNodeMouseOut() {
    tooltip.transition()
        .duration(500)
        .style('opacity', 0);
}

// 连线悬停处理
function handleLinkMouseOver(event, d) {
    tooltip.transition()
        .duration(200)
        .style('opacity', .9);
    tooltip.html(`<strong>${d.source.id} → ${d.target.id}</strong><br/>${d.type}关系<br/>${d.description || ''}`)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');
}

function handleLinkMouseOut() {
    tooltip.transition()
        .duration(500)
        .style('opacity', 0);
}

// 创建分组图例
// 在createGroupLegend函数中添加关系类型图例的生成代码
function createGroupLegend() {
    const legendContainer = document.getElementById('group-legend');
    
    // 清空容器
    legendContainer.innerHTML = '';
    
    // 不再添加人物分组标题
    
    // 定义要显示的分组（按照指定顺序）
    const displayGroups = [
        '主角',
        '金陵十二钗正册',
        '金陵十二钗副册',
        '贾府',
        '林府',
        '薛府',
        '次要角色'
    ];
    
    // 为每个分组创建图例项
    displayGroups.forEach(group => {
        if (groupColors[group]) { // 只显示我们定义了颜色的分组
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item me-4 mb-2';
            
            const colorBox = document.createElement('span');
            colorBox.className = 'color-box me-2';
            colorBox.style.backgroundColor = groupColors[group];
            
            const label = document.createElement('span');
            label.textContent = group;
            
            legendItem.appendChild(colorBox);
            legendItem.appendChild(label);
            legendContainer.appendChild(legendItem);
        }
    });
    
    // 添加关系类型图例
    const relationLegend = document.getElementById('relation-legend');
    relationLegend.innerHTML = ''; // 清空容器
    
    // 为每种关系类型创建图例项
    Object.entries(relationColors).forEach(([relationType, color]) => {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item me-4 mb-2';
        
        const colorBox = document.createElement('span');
        colorBox.className = 'color-box me-2';
        colorBox.style.backgroundColor = color;
        
        const label = document.createElement('span');
        label.textContent = relationType + '关系';
        
        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        relationLegend.appendChild(legendItem);
    });
}

// 添加事件监听器
function addEventListeners() {
    // 关闭信息面板
    document.getElementById('close-info').addEventListener('click', () => {
        document.getElementById('info-panel').style.display = 'none';
        selectedNode = null;
        resetHighlight();
    });
    
    // 重置高亮按钮
    document.getElementById('reset-highlight').addEventListener('click', () => {
        resetHighlight();
        // 保持信息面板打开，但不再高亮关联节点
    });

    // 重置视图
    document.getElementById('reset-view').addEventListener('click', resetView);

    // 搜索功能
    document.getElementById('search').addEventListener('input', handleSearch);

    // 关系类型筛选
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', function(event) {
            // 如果用户选中了一个复选框，取消选中其他复选框
            if (event.target.checked) {
                document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    if (cb !== event.target) {
                        cb.checked = false;
                    }
                });
            }
            applyFilters();
        });
    });

    // 家族筛选功能已移除

    // 点击空白处重置
    svg.on('click', () => {
        if (selectedNode) {
            document.getElementById('info-panel').style.display = 'none';
            selectedNode = null;
            resetHighlight();
        }
    });

    // 窗口大小变化时重新调整
    window.addEventListener('resize', debounce(() => {
        width = document.getElementById('graph-container').clientWidth;
        height = document.getElementById('graph-container').clientHeight;
        svg.attr('width', width).attr('height', height);
        simulation.force('center', d3.forceCenter(width / 2, height / 2));
        simulation.alpha(0.3).restart();
    }, 250));
}

// 重置高亮
function resetHighlight() {
    container.selectAll('.node circle')
        .attr('r', d => d.group === '次要角色' ? 7 : 10)
        .attr('stroke-width', d => d.group === '次要角色' ? 1 : 2)
        .attr('stroke-opacity', 1)
        .attr('fill-opacity', 1)
        .style('filter', 'none');

    container.selectAll('.node text')
        .attr('opacity', 1);

    container.selectAll('.link')
        .attr('stroke-opacity', 0.6)
        .style('filter', 'none');
}

// 重置视图
function resetView() {
    // 重置缩放和平移
    svg.transition().duration(750).call(
        d3.zoom().transform,
        d3.zoomIdentity
    );

    // 重置筛选器
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    // 家族筛选已移除
    document.getElementById('search').value = '';

    // 重新渲染图形
    renderGraph(graph);

    // 关闭信息面板
    document.getElementById('info-panel').style.display = 'none';
    selectedNode = null;
}

// 搜索处理
function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    if (!searchTerm) {
        applyFilters();
        return;
    }

    // 筛选节点
    const filteredNodes = graph.nodes.filter(node => 
        node.id.toLowerCase().includes(searchTerm) ||
        (node.description && node.description.toLowerCase().includes(searchTerm))
    );

    const nodeIds = new Set(filteredNodes.map(node => node.id));

    // 筛选连线
    const filteredLinks = graph.links.filter(link => 
        nodeIds.has(link.source.id || link.source) && nodeIds.has(link.target.id || link.target)
    );

    // 更新视图
    updateGraph({
        nodes: filteredNodes,
        links: filteredLinks
    });

    // 如果只有一个结果，自动选中
    if (filteredNodes.length === 1) {
        selectedNode = filteredNodes[0];
        showInfoPanel(selectedNode);
        highlightConnections(selectedNode);
    }
}

// 应用筛选器
function applyFilters() {
    // 获取选中的关系类型
    const selectedRelationTypes = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.value);

    // 筛选连线
    let filteredLinks;
    if (selectedRelationTypes.length === 0) {
        // 如果没有选中任何关系类型，显示所有关系
        // 先停止当前模拟
        if (simulation) simulation.stop();
        // 重置选中状态
        selectedNode = null;
        // 关闭信息面板
        document.getElementById('info-panel').style.display = 'none';
        // 完全重新渲染图形
        renderGraph(graph);
        return; // 提前返回，避免执行后续代码
    } else {
        // 否则只显示选中的关系类型
        filteredLinks = graph.links.filter(link => 
            selectedRelationTypes.includes(link.type)
        );
    }

    // 筛选节点
    let nodeIds = new Set();
    // 包含所有连线涉及的节点
    filteredLinks.forEach(link => {
        nodeIds.add(link.source.id || link.source);
        nodeIds.add(link.target.id || link.target);
    });

    const filteredNodes = graph.nodes.filter(node => nodeIds.has(node.id));

    // 更新视图
    updateGraph({
        nodes: filteredNodes,
        links: filteredLinks
    });
}

// 更新图形
function updateGraph(filteredData) {
    // 停止当前模拟
    simulation.stop();
    
    // 重置选中状态，避免筛选后状态错乱
    if (selectedNode) {
        selectedNode = null;
        document.getElementById('info-panel').style.display = 'none';
    }
    
    // 清空容器并重新创建元素，避免更新错误
    container.selectAll('*').remove();
    
    // 创建连线
    const link = container.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(filteredData.links)
        .enter().append('line')
        .attr('class', d => `link ${d.type}-link`)
        .attr('stroke-width', d => Math.sqrt(d.value))
        .attr('stroke', d => relationColors[d.type] || '#999')
        .on('mouseover', handleLinkMouseOver)
        .on('mouseout', handleLinkMouseOut);
    
    // 创建节点组
    const node = container.append('g')
        .attr('class', 'nodes')
        .selectAll('.node')
        .data(filteredData.nodes)
        .enter().append('g')
        .attr('class', 'node')
        .call(d3.drag()
            .on('start', dragStarted)
            .on('drag', dragged)
            .on('end', dragEnded))
        .on('click', handleNodeClick)
        .on('mouseover', handleNodeMouseOver)
        .on('mouseout', handleNodeMouseOut);
    
    // 添加节点圆圈
    node.append('circle')
        .attr('r', d => d.group === '次要角色' ? 7 : 10)
        .attr('fill', d => groupColors[d.group] || groupColors['次要角色'])
        .attr('stroke', '#fff')
        .attr('stroke-width', d => d.group === '次要角色' ? 1 : 2);
    
    // 添加节点文本
    node.append('text')
        .attr('dy', d => d.group === '次要角色' ? 15 : 20)
        .attr('text-anchor', 'middle')
        .text(d => d.id)
        .attr('font-size', d => d.group === '次要角色' ? '8px' : '10px');
    
    // 重启模拟
    simulation.nodes(filteredData.nodes);
    simulation.force('link').links(filteredData.links);
    simulation.alpha(1).restart();
    
    // 更新模拟的tick事件处理
    simulation.on('tick', () => {
        // 边界检测，防止节点移出可视区域
        filteredData.nodes.forEach(d => {
            // 为次要人物节点添加额外的中心引力
            if (d.group === '次要角色') {
                // 计算到中心的距离
                const dx = d.x - width / 2;
                const dy = d.y - height / 2;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 如果距离中心太远，施加额外引力
                if (distance > Math.min(width, height) / 3) {
                    d.x -= dx * 0.03;
                    d.y -= dy * 0.03;
                }
            }
            
            // 边界约束，确保节点在容器内
            const r = 15; // 节点半径加一些边距
            d.x = Math.max(r, Math.min(width - r, d.x));
            d.y = Math.max(r, Math.min(height - r, d.y));
        });
        
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node
            .attr('transform', d => `translate(${d.x},${d.y})`);
    });

}

// 工具函数：防抖
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);