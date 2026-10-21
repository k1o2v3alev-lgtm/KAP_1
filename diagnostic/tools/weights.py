# Баллы за задание: СОР — по 1 баллу за задание; СОЧ — по 2 балла (10 заданий = 20 баллов)
MAIN = {'SOR-6-1': [1] * 8, 'SOR-6-2': [1] * 9, 'SOR-6-3': [1] * 8, 'SOR-6-4': [1] * 7, 'SOCH-6-Q1': [2] * 10, 'SOCH-6-Q2': [2] * 10}
LMD = {'LMD-SOR-1': [1] * 8, 'LMD-SOR-2': [1] * 8, 'LMD-SOR-3': [1] * 8, 'LMD-SOR-4': [1] * 8, 'LMD-SOCH-Q1': [2] * 10, 'LMD-SOCH-Q2': [2] * 10}
for d in (MAIN, LMD):
    for k, v in d.items():
        if 'SOCH' in k: assert sum(v) == 20, k
