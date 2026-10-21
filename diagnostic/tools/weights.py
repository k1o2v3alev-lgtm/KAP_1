# Баллы за задание: сумма равна нормативному максимуму (СОР — 14, СОЧ — 20)
MAIN = {'SOR-6-1': [1, 2, 2, 2, 1, 2, 2, 2], 'SOR-6-2': [1, 1, 1, 1, 2, 2, 2, 2, 2], 'SOR-6-3': [2, 2, 2, 2, 2, 1, 1, 2], 'SOR-6-4': [2] * 7, 'SOCH-6-Q1': [2] * 10, 'SOCH-6-Q2': [2] * 10}
LMD = {'LMD-SOR-1': [1, 2, 2, 2, 1, 2, 2, 2], 'LMD-SOR-2': [1, 2, 2, 2, 1, 2, 2, 2], 'LMD-SOR-3': [1, 2, 2, 2, 1, 2, 2, 2], 'LMD-SOR-4': [1, 2, 2, 2, 1, 2, 2, 2], 'LMD-SOCH-Q1': [2] * 10, 'LMD-SOCH-Q2': [2] * 10}
MAXES = {k: (20 if 'SOCH' in k else 14) for k in list(MAIN) + list(LMD)}
for d in (MAIN, LMD):
    for k, v in d.items(): assert sum(v) == MAXES[k], (k, sum(v))
